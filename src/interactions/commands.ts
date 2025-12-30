import { Routes } from 'discord-api-types/v10';
import { REST } from '@discordjs/rest';
import { PermissionsBitField } from 'discord.js';
import type { BotConfig } from '../config.js';

/**
 * Registra los slash commands del bot.
 * @param {import('../config.js').BotConfig} config
 */
export async function registerCommands(config: BotConfig) {
  const rest = new REST({ version: '10' }).setToken(config.token);

  const commands = [
    {
      name: 'inactividad',
      description: 'Herramientas administrativas para gestionar inactividad',
      default_member_permissions: String(PermissionsBitField.Flags.Administrator),
      dm_permission: false,
      options: [
        {
          type: 1,
          name: 'listar',
          description: 'Muestra las inactividades registradas',
        },
        {
          type: 1,
          name: 'estadisticas',
          description: 'Muestra estadísticas de inactividad por rol',
        },
        {
          type: 2,
          name: 'roles',
          description: 'Gestiona los roles monitoreados',
          options: [
            {
              type: 1,
              name: 'agregar',
              description: 'Agrega un rol a la lista de seguimiento',
              options: [
                {
                  type: 8,
                  name: 'rol',
                  description: 'Rol a seguir',
                  required: true,
                },
              ],
            },
            {
              type: 1,
              name: 'eliminar',
              description: 'Elimina un rol de la lista de seguimiento',
              options: [
                {
                  type: 8,
                  name: 'rol',
                  description: 'Rol a dejar de seguir',
                  required: true,
                },
              ],
            },
            {
              type: 1,
              name: 'listar',
              description: 'Muestra los roles actualmente monitoreados',
            },
          ],
        },
      ],
    },
    {
      name: 'dis-session',
      description: 'Genera una sesión de desconexión con código',
      dm_permission: false,
    }
  ];

  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
}
