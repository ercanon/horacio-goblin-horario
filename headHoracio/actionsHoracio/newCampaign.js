const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    PermissionFlagsBits
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
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const name = interaction.options.getString("name");
        const color = interaction.options.getString("color") || "#0099FF";
        const channelInteract = interaction.guild.channels;

        try {
            if (channelInteract.cache.find((category) =>
                category.name === name && category.type === ChannelType.GuildCategory)) {
                return await interaction.editReply({
                    content: `⚠️ ¡No hacer lío! ${name} ya está ahí, no repetir.`,
                    flags: [MessageFlags.Ephemeral],
                });
            }

            const role = await interaction.guild.roles.create({
                name,
                color
            });

            const category = await channelInteract.create({
                name,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [
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
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.Connect,
                            PermissionFlagsBits.Speak,
                        ],
                    },
                ],
            });

            const channelList = [
                {
                    name: "next-session",
                    type: ChannelType.GuildAnnouncement,
                    edit: [
                        [{ SendMessages: null }, role.id],
                        [{ SendMessages: true, ViewChannel: true }, process.env.CLIENT_ID],
                    ],
                },
                {
                    name: "gm",
                    type: ChannelType.GuildText,
                    delete: [role.id],
                },
                { name: "general", type: ChannelType.GuildText },
                { name: "memes", type: ChannelType.GuildText },
                {
                    name: "info-players",
                    type: ChannelType.GuildText,
                    edit: [[{ SendMessages: null }, role.id]],
                },
                { name: "General", type: ChannelType.GuildVoice },
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

                if (channelData.edit) {
                    for (const [id, permissions] of channelData.edit) {
                        await channel.permissionOverwrites.edit(
                            permissions,
                            id,
                        );
                    }
                }
                if (channelData.delete) {
                    for (const id of channelData.delete) {
                        await channel.permissionOverwrites.delete(id);
                    }
                }
                if (channelData.name === "next-session") {
                    setSchedule(name, color, channel.id).then(async (sheetID) => {
                        const msg = await channel.send(`📆  [**Horario de sesiones**](<https://docs.google.com/spreadsheets/d/149bvpWOX1h7Dk_agutMBA_1-oGRF4cV9vR_kTdr8kug/#gid=${sheetID}>)  📆`);
                        await msg.pin();
                    });
                }
            }
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
