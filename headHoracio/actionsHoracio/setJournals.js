const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("set_journals") //Does not admit Caps
        .setDescription("Create a journal channel for each player"),
    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            if (!interaction.channel.permissionOverwrites?.cache.get(interaction.guild.members.me.roles.highest)?.allow.has(PermissionFlagsBits.SendMessages)) {
                return await interaction.editReply({
                    content: `⚠️ ¡Puerta cerrada! Horacio no puede entrar aquí… ¿maldición o mala suerte?`,
                    flags: [MessageFlags.Ephemeral],
                });
            }

            const category = interaction.channel.parent;
            const role = interaction.guild.roles.cache.find((role) =>
                role.name.toLowerCase() === category.name.toLowerCase());
            const memberList = interaction.guild.members.cache.filter((member) =>
                member.roles.cache.has(role.id))

            if (!memberList) {
                return await interaction.editReply({
                    content: `⚠️ ¡Eh! ¿Dónde están? Horacio buscó, pero role solito, sin jugadores.`,
                    flags: [MessageFlags.Ephemeral],
                });
            }
            
            const channelInteract = interaction.guild.channels;
            for (const member of memberList.values()) {
                await channelInteract.create({
                    name: `${member.user.username}-journal`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages
                            ],
                        },
                        {
                            id: member.user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageChannels
                            ],
                        },
                    ]
                });
            }        

            await interaction.editReply({
                content: "📂 ¡Journals vivos! No comestibles, solo para escribir.",
                flags: [MessageFlags.Ephemeral],
            });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ¡Raro raro! Horacio no encuentra journals… seguro culpa de duendes. ${error}`,
                flags: [MessageFlags.Ephemeral],
            });
        }
    }
};
