const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("new_campaign")
        .setDescription("Create a new RPG category in the server")
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("Name of the Campaign")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("color")
                .setDescription("Color of the role (Hex format, e.g. #FF5733)")
                .setRequired(false),
        ),
    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const name = interaction.options.getString("name");
        const color = interaction.options.getString("color") || "#0099FF";

        try {
            if (interaction.guild.channels.cache.find(
                (channel) =>
                    channel.name === name && channel.type === ChannelType.GuildCategory
            )) {
                await interaction.editReply({
                    content: `⚠️ The folder \`${name}\` already exists.`,
                    flags: [MessageFlags.Ephemeral],
                });
            }

            const role = await interaction.guild.roles.create({
                name,
                color,
                reason: `Role created for the new campaign: ${name}`,
            });

            const category = await interaction.guild.channels.create({
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
                const channel = await interaction.guild.channels.create({
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
            }
            console.log("📂 ¡Nueva categoría! Horacio no firmó para esto, no descansa...");
        }
        catch (error) {
            console.error("Error creating the folder:", error);
            await interaction.editReply({
                content: "❌ ¡Horacio intenta, categoría no aparece! Magia mala, sí sí.",
                flags: [MessageFlags.Ephemeral],
            });
        }
    },
};
