const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    PermissionFlagsBits,
    GuildScheduledEventEntityType,
    GuildScheduledEventRecurrenceRuleFrequency
} = require("discord.js");
const { setSchedule } = require("../eyesHoracio.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("new_campaign") //Does not admit Caps
        .setDescription("Create a new RPG category in the server")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("Name of the Campaign")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("color")
                .setDescription("Color of the role (e.g. #FF5733)")
                .setRequired(false)
        ).addAttachmentOption(option =>
            option
                .setName("image")
                .setDescription("Scheduled Event banner image")
                .setRequired(false)
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const name = interaction.options.getString("name");
        const color = interaction.options.getString("color") || "#0099FF";
        const channelInteract = interaction.guild.channels;
        const botRole = interaction.guild.members.me.roles.highest;

        try {
            if (!interaction.channel.permissionOverwrites?.cache.get(botRole)?.allow.has(PermissionFlagsBits.SendMessages)) {
                return await interaction.editReply({
                    content: `⚠️ ¡Puerta cerrada! Horacio no puede entrar aquí… ¿maldición o mala suerte?`,
                    flags: [MessageFlags.Ephemeral],
                });
            }
            if (channelInteract.cache.find((category) =>
                category.type === ChannelType.GuildCategory && category.name.toLowerCase() === name.toLowerCase())) {
                return await interaction.editReply({
                    content: `⚠️ ¡No hacer lío! ${name} ya está ahí, no repetir.`,
                    flags: [MessageFlags.Ephemeral],
                });
            }

            const role = await interaction.guild.roles.create({
                name,
                color
            });
            console.log("📝 ¡Eh! Rol asignado, ahora eres alguien… ¡o algo!")

            const category = await channelInteract.create({
                name,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                        ],
                    },
                    {
                        id: role.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                        ],
                    },
                    {
                        id: interaction.guild.id,
                        deny: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                        ],
                    }
                ],
            });
            console.log("📝 ¡Puf! Nueva categoría, ahora todo está menos desordenado… un poco.")

            const channelList = [
                {
                    name: "next-session",
                    type: ChannelType.GuildAnnouncement,
                    edit: [[botRole, { ViewChannel: true, SendMessages: true }], [role.id, { SendMessages: null }]]
                },
                {
                    name: "gm",
                    type: ChannelType.GuildText,
                    delete: [role.id],
                    edit: [[botRole, { ViewChannel: true, SendMessages: true }]]
                },
                {
                    name: "general",
                    type: ChannelType.GuildText
                },
                {
                    name: "memes",
                    type: ChannelType.GuildText
                },
                {
                    name: "info-players",
                    type: ChannelType.GuildText,
                    edit: [[role.id, { SendMessages: null }]]
                },
                {
                    name: "General",
                    type: ChannelType.GuildVoice
                },
                {
                    name: "Private",
                    type: ChannelType.GuildVoice,
                    delete: [role.id],
                },
            ];

            for (const channelData of channelList) {
                const channel = await channelInteract.create({
                    name: channelData.name,
                    type: channelData.type,
                    parent: category.id,
                });
                console.log(`📝 ¡Nueva cueva de palabras! ${channel.name} ahora existe.`)

                if (channelData.edit) {
                    for (const [id, permissions] of channelData.edit)
                        await channel.permissionOverwrite?.edit(id, permissions);
                }
                if (channelData.delete) {
                    for (const id of channelData.delete) 
                        await channel.permissionOverwrites.delete(id);
                }
                console.log("📝 ¡Zas! Permisos nuevos, canal más seguro (o más peligroso).")

                if (channelData.name === "next-session") {
                    setSchedule(name, color, channel.id).then(async (newSchedule) => {
                        const msg = await channel.send(`📆  [**Horario de sesiones**](<https://docs.google.com/spreadsheets/d/149bvpWOX1h7Dk_agutMBA_1-oGRF4cV9vR_kTdr8kug/#gid=${newSchedule}>)  📆`);
                        await msg.pin();
                        console.log("📝 ¡Zas! Horario apareció, ahora a organizarse.")
                    });
                }
            }

            const msDay = Date.now() + 365 * 24 * 60 * 60 * 1000;
            await interaction.guild.scheduledEvents.create({
                name: "#0 Session",
                scheduledStartTime: msDay,
                scheduledEndTime: msDay + 60 * 60 * 1000,
                privacyLevel: 2,
                entityType: GuildScheduledEventEntityType.External,
                entityMetadata: { location: name },
                recurrenceRule: {
                    startAt: msDay,
                    frequency: GuildScheduledEventRecurrenceRuleFrequency.Yearly,
                    interval: 1,
                },
                image: interaction.options.getAttachment("image")?.url || null
            });
            console.log("📝 ¡Tarán! Evento en su sitio, goblin con calendario listo.")

            await interaction.editReply({
                content: "📂 ¡Nueva categoría! Horacio no firmó para esto, no descansa...",
                flags: [MessageFlags.Ephemeral],
            });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ¡Horacio intenta, categoría no aparece! Magia mala, sí sí. ${error}`,
                flags: [MessageFlags.Ephemeral],
            });
        }
    }
};
