const {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");
const msgPattern = /^<@!?&?\d+> #\d+ Session: .+$/

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear_reminders") //Does not admit Caps
        .setDescription("Clear schedule reminders from the channel")
        .addIntegerOption((option) =>
            option
                .setName("amount")
                .setDescription("Number of recent messages to delete")
                .setRequired(true)
        ),
    msgPattern,
    async execute(interaction) {
        await interaction.deferReply?.({ flags: [MessageFlags.Ephemeral] });
        const { channel } = interaction;
        const botRole = interaction.guild?.members.me.roles.highest || interaction.botRole;

        try {
            if (channel.permissionsFor(botRole)?.has(PermissionFlagsBits.SendMessages, false)) {
                const lastMsgs = await channel.messages.fetch({ limit: interaction.options?.getInteger?.("amount") || 20 })
                for (const msg of lastMsgs.values()) {
                    if (!msgPattern.test(msg.content) && !msg.pinned && msg.deletable) {
                        await msg.delete().catch((error) =>
                            console.error("❌ ¡Bah! Mensaje terco, no se deja borrar. ¿Magia oscura?", error));
                    }
                }

                await interaction.editReply({
                    content: "⚠️ ¡Puf! Mensajes desaparecidos, como magia (o garra de Horacio).",
                    flags: [MessageFlags.Ephemeral],
                });
            }
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ Goma de borrar no funciona… seguro no tiene energia. ${error}`,
                flags: [MessageFlags.Ephemeral],
            });
        }
    }
};