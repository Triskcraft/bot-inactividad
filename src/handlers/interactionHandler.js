import { PermissionsBitField } from 'discord.js';
import { DateTime } from 'luxon';
import { buildInactivityModal, buildInactivityPanel } from '../interactions/inactivityPanel.js';
import { parseUserTime, formatForUser } from '../utils/time.js';
import { logger } from '../logger.js';

/**
 * @param {import('discord.js').Client} client
 * @param {import('../services/inactivityService.js').InactivityService} inactivityService
 * @param {import('../services/roleService.js').RoleService} roleService
 * @param {import('../config.js').BotConfig} config
 */
export function registerInteractionHandlers(client, inactivityService, roleService, config) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton()) {
        await handleButton(interaction, inactivityService);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction, inactivityService);
      } else if (interaction.isChatInputCommand()) {
        await handleCommand(interaction, inactivityService, roleService, config);
      }
    } catch (error) {
      logger.error({ err: error, interaction: interaction.id }, 'Error procesando interacción');
      if (interaction.isRepliable()) {
        const replyContent = 'Ocurrió un error inesperado al procesar tu solicitud.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: replyContent, ephemeral: true });
        } else {
          await interaction.reply({ content: replyContent, ephemeral: true });
        }
      }
    }
  });

  client.once('ready', async () => {
    const channel = await client.channels.fetch(config.inactivityChannelId);
    if (!channel?.isTextBased()) {
      logger.warn('El canal de interacciones no está disponible');
      return;
    }

    const existing = await channel.messages.fetch({ limit: 10 });
    const anchor = existing.find((message) => message.author.id === client.user.id && message.components.length > 0);
    const { embed, components } = buildInactivityPanel();

    if (anchor) {
      await anchor.edit({ embeds: [embed], components });
    } else {
      await channel.send({ embeds: [embed], components });
    }

    logger.info('Panel de inactividad desplegado.');
  });
}

async function handleButton(interaction, inactivityService) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Solo disponible dentro del servidor.', ephemeral: true });
    return;
  }

  const member = interaction.member;

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
      const record = inactivityService.getInactivity(member.id);
      if (!record) {
        await interaction.reply({ content: 'No tienes inactividad registrada.', ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Estarás inactivo hasta ${formatForUser(record.endsAt)}.`,
        ephemeral: true,
      });
      break;
    }
    default:
      await interaction.reply({ content: 'Acción desconocida.', ephemeral: true });
  }
}

async function handleModal(interaction, inactivityService) {
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
    inactivityService.markInactivity(interaction.guildId, interaction.member, untilDate, interaction.customId);
    await interaction.reply({
      content: `Registramos tu inactividad hasta ${formatForUser(untilDate)}.`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({ content: error.message, ephemeral: true });
  }
}

async function handleCommand(interaction, inactivityService, roleService, config) {
  if (interaction.commandName !== 'inactividad') return;
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: 'Solo administradores pueden usar estos comandos.', ephemeral: true });
    return;
  }

  const group = interaction.options.getSubcommandGroup(false);
  if (!group) {
    switch (interaction.options.getSubcommand()) {
      case 'listar':
        await handleList(interaction, inactivityService);
        return;
      case 'estadisticas':
        await handleStats(interaction, inactivityService, roleService);
        return;
      default:
        await interaction.reply({ content: 'Comando desconocido.', ephemeral: true });
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
        await interaction.reply({ content: 'Subcomando desconocido.', ephemeral: true });
        return;
    }
  }

  await interaction.reply({ content: 'Comando desconocido.', ephemeral: true });
}

async function handleList(interaction, inactivityService) {
  const records = inactivityService.listInactivities(interaction.guildId);
  if (!records.length) {
    await interaction.reply({ content: 'No hay miembros inactivos actualmente.', ephemeral: true });
    return;
  }

  const descriptions = await Promise.all(
    records.map(async (record) => {
      const member = await interaction.guild.members.fetch(record.userId).catch(() => null);
      return `${member ?? record.userId} → ${formatForUser(record.endsAt)}`;
    }),
  );

  await interaction.reply({ content: descriptions.join('\n'), ephemeral: true });
}

async function handleStats(interaction, inactivityService, roleService) {
  const records = inactivityService.listInactivities(interaction.guildId);
  const tracked = roleService.listRoles(interaction.guildId);
  if (!tracked.length) {
    await interaction.reply({ content: 'No hay roles configurados. Usa `/inactividad roles agregar`.', ephemeral: true });
    return;
  }

  const lines = [];
  for (const roleId of tracked) {
    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;
    const members = role.members;
    const inactive = members.filter((member) => records.some((record) => record.userId === member.id));
    const activeCount = members.size - inactive.size;
    lines.push(`**${role.name}** — Inactivos: ${inactive.size} | Activos: ${activeCount}`);
  }

  const snapshots = roleService.getSnapshots(interaction.guildId);
  if (snapshots.length) {
    lines.push('\nHistorial (últimos 30 días):');
    for (const snapshot of snapshots.slice(0, 10)) {
      lines.push(`• <t:${snapshot.capturedAt.toSeconds()}:F> — <@&${snapshot.roleId}> → Inactivos ${snapshot.inactiveCount}, Activos ${snapshot.activeCount}`);
    }
  }

  await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

async function handleRoleAdd(interaction, roleService, config) {
  const role = interaction.options.getRole('rol', true);
  roleService.addRole(interaction.guildId, role.id);
  await interaction.reply({ content: `Seguiremos el rol ${role}.`, ephemeral: true });
  await logAdminAction(interaction, config, `${interaction.user} agregó el rol ${role} al seguimiento.`);
}

async function handleRoleRemove(interaction, roleService, config) {
  const role = interaction.options.getRole('rol', true);
  roleService.removeRole(interaction.guildId, role.id);
  await interaction.reply({ content: `Eliminamos el rol ${role} del seguimiento.`, ephemeral: true });
  await logAdminAction(interaction, config, `${interaction.user} eliminó el rol ${role} del seguimiento.`);
}

async function handleRoleList(interaction, roleService) {
  const roles = roleService.listRoles(interaction.guildId);
  if (!roles.length) {
    await interaction.reply({ content: 'No hay roles monitoreados.', ephemeral: true });
    return;
  }

  const mentions = roles.map((roleId) => `<@&${roleId}>`);
  await interaction.reply({ content: `Roles monitoreados: ${mentions.join(', ')}`, ephemeral: true });
}

async function logAdminAction(interaction, config, message) {
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
