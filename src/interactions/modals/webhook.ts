import { db } from '#database'
import {
    EmbedBuilder,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ModalSubmitInteraction,
} from 'discord.js'
import { SignJWT } from 'jose'
import { randomBytes } from 'node:crypto'
import { encrypt } from '../../utils/encript.ts'
import { envs } from '#config'
import { getRank } from '../../utils/roles.ts'
import { ModalInteractionHandler } from '#interactions.service'

const alg = 'HS256'

export default class extends ModalInteractionHandler {
    override regex = /^wh:add$/

    static override build(): ModalBuilder {
        return new ModalBuilder()
            .setCustomId('wh:add')
            .setTitle('Create a Webhook Token')
            .addLabelComponents(
                new LabelBuilder()
                    .setLabel('Permisos')
                    .setStringSelectMenuComponent(
                        new StringSelectMenuBuilder()
                            .setCustomId('permissions')
                            .setRequired(true)
                            .setMinValues(1)
                            .addOptions(
                                new StringSelectMenuOptionBuilder()
                                    .setLabel('digs')
                                    .setValue('digs')
                                    .setDescription('Webhook de digs'),
                            ),
                    ),
                new LabelBuilder()
                    .setLabel('Nombre')
                    .setDescription('Para identificar el token')
                    .setTextInputComponent(
                        new TextInputBuilder()
                            .setCustomId('name')
                            .setRequired(true)
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false),
                    ),
            )
    }

    override async run(interaction: ModalSubmitInteraction<'cached'>) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        })
        const secret = randomBytes(32).toString('hex')
        const permissions =
            interaction.fields.getStringSelectValues('permissions')
        const name = interaction.fields.getTextInputValue('name')
        const wt = await db.webhookToken.create({
            data: {
                secret: encrypt(secret).payload,
                permissions: [...permissions],
                name,
                discord_user: {
                    connectOrCreate: {
                        create: {
                            id: interaction.user.id,
                            rank: getRank([
                                ...interaction.member.roles.cache.values(),
                            ]),
                        },
                        where: {
                            id: interaction.user.id,
                        },
                    },
                },
            },
        })
        const jwt = await new SignJWT({
            id: wt.id,
            user: interaction.user.id,
            permissions,
            name,
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .sign(envs.JWT_SECRERT)

        const embedDescription = [
            'Estas son tus credenciales:',
            'Se mostrarán por única vez y no se pueden volver a recuperar',
            'Asegurate de no revelarlas',
            'Si tienes la sospecha de que han sido reveladas por favor eliminalas y genera una nueva',
        ].join('\n- ')
        const embed = new EmbedBuilder()
            .setDescription(embedDescription)
            .addFields(
                {
                    name: 'Secret',
                    value: secret,
                },
                {
                    name: 'Token',
                    value: jwt,
                },
            )
        interaction.editReply({
            embeds: [embed],
        })
        // const { payload, protectedHeader } = await jwtVerify(jwt + '1', jwtsecret)
    }
}
