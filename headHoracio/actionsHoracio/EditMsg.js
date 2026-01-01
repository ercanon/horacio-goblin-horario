const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("edit_msg")
        .setDescription("Edita un mensaje por ID")
        .addStringOption(option =>
            option
                .setName("id")
                .setDescription("Message ID")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("contents")
                .setDescription("New message content")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const messageId = interaction.options.getString("id");
        const newContent = interaction.options.getString("contenido");
        try {
            const message = await interaction.channel.messages.fetch(messageId);

            await message.edit({ content: newContent });

            await interaction.editReply({
                content: "✅ Mensaje editado correctamente.",
                flags: [MessageFlags.Ephemeral],
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: "❌ No pude encontrar o editar ese mensaje.",
                flags: [MessageFlags.Ephemeral],
            });
        }
    }
};