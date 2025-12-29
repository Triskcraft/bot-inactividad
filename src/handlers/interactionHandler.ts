import { ButtonInteraction, Client, CommandInteraction, EmbedBuilder, GuildMember, ModalSubmitInteraction, PermissionsBitField, Role } from 'discord.js';
import { DateTime } from 'luxon';
import { buildInactivityModal, buildInactivityPanel } from '../interactions/inactivityPanel.js';
import { parseUserTime, formatForUser } from '../utils/time.js';
import { logger } from '../logger.js';
import type { InactivityService } from '../services/inactivityService.js';
import type { RoleService } from '../services/roleService.js';
import type { BotConfig } from '../config.js';
import { db } from '../prisma/database.js';
import type { RoleStatistic } from '../prisma/generated/client.js';

export function registerInteractionHandlers({ client, config, inactivityService, roleService }: { client: Client, inactivityService: InactivityService, roleService: RoleService, config: BotConfig }) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton()) {
        await handleButton(interaction, inactivityService);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction, inactivityService);
      } else if (interaction.isChatInputCommand()) {
        await handleCommand(interaction as CommandInteraction<"cached">, inactivityService, roleService, config);
      }
    } catch (error) {
      logger.error({ err: error, interaction: interaction.id }, 'Error procesando interacción');
      if (interaction.isRepliable()) {
        const replyContent = 'Ocurrió un error inesperado al procesar tu solicitud.';
        const ephemeral = !(interaction.isChatInputCommand() && interaction.commandName === 'inactividad');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: replyContent, ephemeral });
        } else {
          await interaction.reply({ content: replyContent, ephemeral });
        }
      }
    }
  });

  client.once('ready', async () => {
    const channel = await client.channels.fetch(config.inactivityChannelId);
    if (!channel) {
      return logger.warn('Canal no encontrado');
    }
    if (!channel.isTextBased()) {
      logger.warn('El canal de interacciones no está disponible');
      return;
    }

    const existing = await channel.messages.fetch({ limit: 10 });
    const anchor = existing.find((message) => message.author.id === client.user?.id && message.components.length > 0);
    const { embed, components } = buildInactivityPanel();

    if (anchor) {
      await anchor.edit({ embeds: [embed], components });
    } else {
      if (channel.isTextBased()) {
        await channel.send({ embeds: [embed], components });
        return;
      }
    }

    logger.info('Panel de inactividad desplegado.');
  });
}

async function handleButton(interaction: ButtonInteraction, inactivityService: InactivityService) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Solo disponible dentro del servidor.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;

  switch (interaction.customId) {
    case 'inactivity:set':
    case 'inactivity:edit': {
      await interaction.showModal(buildInactivityModal(interaction.customId === 'inactivity:set' ? 'modal:set' : 'modal:edit'));
      break;
    }
    case 'inactivity:clear': {
      inactivityService.clearInactivity(member.id);
      await interaction.reply({ content: 'Tu inactividad fue eliminada. ¡Bienvenido de vuelta!', ephemeral: true });
      break;
    }
    case 'inactivity:show': {
      const record = await inactivityService.getInactivity(member.id);
      if (!record) {
        await interaction.reply({ content: 'No tienes inactividad registrada.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Estarás inactivo hasta ${formatForUser(record.ends_at)}.`,
        ephemeral: true,
      });
      break;
    }
    default:
      await interaction.reply({ content: 'Acción desconocida.', ephemeral: true });
  }
}

async function handleModal(interaction: ModalSubmitInteraction, inactivityService: InactivityService) {
  const duration = interaction.fields.getTextInputValue('duration');
  const until = interaction.fields.getTextInputValue('until');

  if (!duration && !until) {
    await interaction.reply({ content: 'Debes completar al menos uno de los campos.', ephemeral: true });
    return;
  }

  try {
    const reference = until || duration;
    const { until: untilDate } = parseUserTime(reference);
    if (untilDate.toMillis() <= DateTime.utc().toMillis()) {
      await interaction.reply({ content: 'La fecha indicada ya pasó. Por favor ingresa un valor en el futuro.', ephemeral: true });
      return;
    }
    inactivityService.markInactivity(interaction.guildId!, interaction.member as GuildMember, untilDate.toJSDate(), interaction.customId);
    await interaction.reply({
      content: `Registramos tu inactividad hasta ${formatForUser(untilDate.toJSDate())}.`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({ content: (error as Error).message, ephemeral: true });
  }
}

async function handleCommand(interaction: CommandInteraction<"cached">, inactivityService: InactivityService, roleService: RoleService, config: BotConfig) {
  if (interaction.commandName === 'inactividad') return inactividadCommand(interaction, inactivityService, roleService, config);
  if (interaction.commandName === 'dis-session') return handleCodeDB(interaction);
  await interaction.reply({ content: 'Comando desconocido.' });
}


async function inactividadCommand(interaction: CommandInteraction<"cached">, inactivityService: InactivityService, roleService: RoleService, config: BotConfig) {
  if (interaction.commandName !== 'inactividad') return;
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: 'Solo administradores pueden usar estos comandos.' });
    return;
  }

  const group = interaction.options.getSubcommandGroup(false);
  if (!group) {
    switch (interaction.options.getSubcommand()) {
      case 'listar':
        await handleList(interaction, inactivityService, roleService);
        return;
      case 'estadisticas':
        await handleStats(interaction, inactivityService, roleService);
        return;
      default:
        await interaction.reply({ content: 'Comando desconocido.' });
        return;
    }
  }

  if (group === 'roles') {
    switch (interaction.options.getSubcommand()) {
      case 'agregar':
        await handleRoleAdd(interaction, roleService, config);
        return;
      case 'eliminar':
        await handleRoleRemove(interaction, roleService, config);
        return;
      case 'listar':
        await handleRoleList(interaction, roleService);
        return;
      default:
        await interaction.reply({ content: 'Subcomando desconocido.' });
        return;
    }
  }

  await interaction.reply({ content: 'Comando desconocido.' });
}

async function handleCodeDB(interaction: CommandInteraction<"cached">) {
  const code = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const discord_id = interaction.user.id;
  const username = interaction.user.username;
  const discord_nickname = interaction.member?.displayName || username;

  try {
    await db.$transaction(async db => {
      await db.linkCode.delete({
        where: { discord_id }
      })
      db.linkCode.create({
        data: { discord_id, discord_nickname, code }
      })
    })

    logger.info({ code, discord_id, discord_nickname }, 'Código registrado en BD');
  } catch (error) {
    logger.error({ err: error, discord_id }, 'Error al guardar código en BD');
    await interaction.reply({
      content: 'Ocurrió un error al generar el código. Intenta nuevamente.',
      ephemeral: true
    });
    return;
  }

  try {
    await interaction.user.send({
      content: `Tu código es: **${code}**`
    });
  } catch (error) {
    logger.warn({ err: error, userId: interaction.user.id }, 'No se pudo enviar DM');
  }

  await interaction.reply({
    content: `Tu código es: **${code}**`,
    ephemeral: true
  });
}

async function handleList(interaction: CommandInteraction<"cached">, inactivityService: InactivityService, roleService: RoleService) {
  const records = await inactivityService.listInactivities(interaction.guildId);
  const trackedRoles = await roleService.listRoles(interaction.guildId);

  if (!trackedRoles.length) {
    await interaction.reply({ content: 'No hay roles configurados. Usa `/inactividad roles agregar`.' });
    return;
  }

  // Obtener todos los miembros del servidor (incluyendo offline)
  await interaction.deferReply();
  let allServerMembers = await interaction.guild.members.fetch();

  // Si no se pueden obtener todos, usar role.members como fallback
  if (!allServerMembers || allServerMembers.size === 0) {
    for (const roleId of trackedRoles) {
      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      if (!role) continue;
      for (const [memberId, member] of role.members) {
        if (!allServerMembers.has(memberId)) {
          allServerMembers.set(memberId, member);
        }
      }
    }
  }

  // Validar que hay miembros
  if (!allServerMembers || allServerMembers.size === 0) {
    await interaction.editReply({ content: 'No se encontraron miembros con los roles monitoreados.' });
    return;
  }

  // Filtrar miembros que tienen los roles monitoreados
  const allMembers = new Map();
  for (const [memberId, member] of allServerMembers) {
    for (const roleId of trackedRoles) {
      if (member.roles.cache.has(roleId)) {
        allMembers.set(memberId, member);
        break;
      }
    }
  }

  // Separar inactivos y activos
  const inactiveMembers = [];
  const activeMembers = [];
  const inactiveIds = new Set(records.map((r) => r.user_id));

  for (const [memberId, member] of allMembers) {
    if (inactiveIds.has(memberId)) {
      const record = records.find((r) => r.user_id === memberId);
      inactiveMembers.push({ member, endsAt: record?.ends_at });
    } else {
      activeMembers.push(member);
    }
  }

  // Crear embed
  const embed = new EmbedBuilder()
    .setTitle('Estado de miembros monitoreados')
    .setColor(0x5865f2)
    .setTimestamp(new Date())
    .setDescription(`Total: **${allMembers.size}** | Inactivos: **${inactiveMembers.length}** | Activos: **${activeMembers.length}**`);

  // Agregar campo de inactivos (máximo 50 caracteres por línea, máximo 1024 caracteres totales)
  if (inactiveMembers.length > 0) {
    const maxLines = 20;
    const inactiveList = inactiveMembers
      .slice(0, maxLines)
      .map((item) => {
        const memberStr = item.member.user.username;
        const endStr = formatForUser(item.endsAt).substring(0, 30);
        return `${memberStr} → ${endStr}`;
      })
      .join('\n');
    const displayText = inactiveMembers.length > maxLines
      ? `${inactiveList}\n... y ${inactiveMembers.length - maxLines} más`
      : inactiveList;
    embed.addFields({
      name: `❌ Inactivos (${inactiveMembers.length})`,
      value: displayText || 'Sin datos',
    });
  } else {
    embed.addFields({
      name: `❌ Inactivos (0)`,
      value: 'No hay miembros inactivos.',
    });
  }

  // Agregar campo de activos (máximo 50 caracteres por línea, máximo 1024 caracteres totales)
  if (activeMembers.length > 0) {
    const maxLines = 20;
    const activeList = activeMembers
      .slice(0, maxLines)
      .map((member) => member.user.username)
      .join('\n');
    const displayText = activeMembers.length > maxLines
      ? `${activeList}\n... y ${activeMembers.length - maxLines} más`
      : activeList;
    embed.addFields({
      name: `✅ Activos (${activeMembers.length})`,
      value: displayText || 'Sin datos',
    });
  } else {
    embed.addFields({
      name: `✅ Activos (0)`,
      value: 'No hay miembros activos.',
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleStats(interaction: CommandInteraction<"cached">, inactivityService: InactivityService, roleService: RoleService) {
  const records = await inactivityService.listInactivities(interaction.guildId);
  const tracked = await roleService.listRoles(interaction.guildId);
  if (!tracked.length) {
    await interaction.reply({ content: 'No hay roles configurados. Usa `/inactividad roles agregar`.' });
    return;
  }

  // Obtener todos los miembros del servidor (incluyendo offline)
  let allServerMembers = await interaction.guild.members.fetch().catch(() => null);

  const summaries = [];
  let totalMembers = 0;
  let totalInactive = 0;
  for (const roleId of tracked) {
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;

    // Filtrar miembros que tienen este rol
    let members;
    if (allServerMembers && allServerMembers.size > 0) {
      // Si tenemos todos los miembros, usar eso
      members = allServerMembers.filter((member) => member.roles.cache.has(roleId));
    } else {
      // Si no, usar role.members como fallback
      members = role.members;
    }

    const inactive = members.filter((member) => records.some((record) => record.user_id === member.id));
    const activeCount = members.size - inactive.size;
    totalMembers += members.size;
    totalInactive += inactive.size;
    summaries.push({
      role,
      total: members.size,
      inactive: inactive.size,
      active: activeCount,
    });
  }

  if (!summaries.length) {
    await interaction.reply({ content: 'No se encontraron roles monitoreados disponibles.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Estadísticas de inactividad')
    .setColor(0x5865f2)
    .setTimestamp(new Date())
    .setDescription('Resumen actualizado de los roles monitoreados.');

  const totalActive = Math.max(totalMembers - totalInactive, 0);
  const totalPercentage = totalMembers ? (totalInactive / totalMembers) * 100 : 0;
  embed.addFields({
    name: 'Visión general',
    value: `Miembros analizados: **${totalMembers}**\nInactivos: **${totalInactive}** (${totalPercentage.toFixed(1)}%)\nActivos: **${totalActive}**`,
  });

  for (const summary of summaries) {
    const percentage = summary.total ? (summary.inactive / summary.total) * 100 : 0;
    embed.addFields({
      name: summary.role.name,
      value: `${buildBar(percentage)} ${percentage.toFixed(1)}% inactivos\nInactivos: **${summary.inactive}** | Activos: **${summary.active}**`,
      inline: summaries.length > 1,
    });
  }

  const snapshots = await roleService.getSnapshots(interaction.guildId);
  const historyField = buildHistoryField(snapshots, summaries);
  if (historyField) {
    embed.addFields(historyField);
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleRoleAdd(interaction: CommandInteraction<"cached">, roleService: RoleService, config: BotConfig) {
  const role = interaction.options.getRole('rol', true);
  roleService.addRole(interaction.guildId, role.id);
  await interaction.reply({ content: `Seguiremos el rol ${role}.` });
  await logAdminAction(interaction, config, `${interaction.user} agregó el rol ${role} al seguimiento.`);
}

async function handleRoleRemove(interaction: CommandInteraction<"cached">, roleService: RoleService, config: BotConfig) {
  const role = interaction.options.getRole('rol', true);
  roleService.removeRole(interaction.guildId, role.id);
  await interaction.reply({ content: `Eliminamos el rol ${role} del seguimiento.` });
  await logAdminAction(interaction, config, `${interaction.user} eliminó el rol ${role} del seguimiento.`);
}

async function handleRoleList(interaction: CommandInteraction<"cached">, roleService: RoleService) {
  const roles = await roleService.listRoles(interaction.guildId);
  if (!roles.length) {
    await interaction.reply({ content: 'No hay roles monitoreados.' });
    return;
  }

  const mentions = roles.map((roleId) => `<@&${roleId}>`);
  await interaction.reply({ content: `Roles monitoreados: ${mentions.join(', ')}` });
}

async function logAdminAction(interaction: CommandInteraction<"cached">, config: BotConfig, message: String) {
  if (!config.adminLogChannelId) return;
  try {
    const channel = await interaction.client.channels.fetch(config.adminLogChannelId);
    if (channel?.isTextBased()) {
      await channel.send({ content: message });
    }
  } catch (error) {
    logger.warn({ err: error }, 'No se pudo enviar mensaje al canal de auditoría');
  }
}

function buildBar(percentage: number) {
  const width = 12;
  const filled = Math.round((percentage / 100) * width);
  const clampedFilled = Math.min(width, Math.max(0, filled));
  const empty = width - clampedFilled;
  return `${'█'.repeat(clampedFilled)}${'░'.repeat(empty)}`;
}

function buildHistoryField(snapshots: RoleStatistic[], summaries: Array<{
  role: Role,
  total: number,
  inactive: number,
  active: number,
}>) {
  if (!snapshots.length) return null;

  const grouped = new Map();
  for (const snapshot of snapshots) {
    if (!grouped.has(snapshot.role_id)) {
      grouped.set(snapshot.role_id, []);
    }
    grouped.get(snapshot.role_id).push(snapshot);
  }

  const lines = [];
  for (const summary of summaries) {
    const roleSnapshots = grouped.get(summary.role.id);
    if (!roleSnapshots?.length) continue;
    const sorted = [...roleSnapshots].sort((a, b) => a.captured_at.toMillis() - b.captured_at.toMillis());
    const recent = sorted.slice(-10);
    const sparkline = buildSparkline(recent.map((item) => percentageInactive(item.inactive_count, item.active_count)));
    const last = recent.at(-1);
    const percentage = last ? percentageInactive(last.inactive_count, last.active_count).toFixed(1) : '0.0';
    lines.push(`${summary.role} ${sparkline} (${percentage}%)`);
  }

  if (!lines.length) return null;

  return {
    name: 'Historial reciente',
    value: lines.join('\n'),
  };
}

function buildSparkline(percentages: Array<number>) {
  if (!percentages.length) return 'sin datos';
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  return percentages
    .map((percentage) => {
      const index = Math.min(blocks.length - 1, Math.max(0, Math.round((percentage / 100) * (blocks.length - 1))));
      return blocks[index];
    })
    .join('');
}

function percentageInactive(inactive: number, active: number) {
  const total = inactive + active;
  if (!total) return 0;
  return (inactive / total) * 100;
}
