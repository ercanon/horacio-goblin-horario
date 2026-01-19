const {
    SlashCommandBuilder,
    MessageFlags
} = require("discord.js");

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Edit Horacio msg.")
        .setType(ApplicationCommandType.Message),

    async execute(interaction) {
        const message = interaction.targetMessage;

        if (message.author.id !== interaction.client.user.id) {
            return interaction.reply({
                content: "❌ Este mensaje no es mío.",
                flags: [MessageFlags.Ephemeral]
            });
        }

        const modal = new ModalBuilder()
            .setCustomId(`edit_${message.id}`)
            .setTitle("Editar mensaje");

        const input = new TextInputBuilder()
            .setCustomId("content")
            .setLabel("Nuevo contenido")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(message.content || "");

        modal.addComponents(
            new ActionRowBuilder().addComponents(input)
        );

        await interaction.showModal(modal);
>>>>>>> Stashed changes
    }
};