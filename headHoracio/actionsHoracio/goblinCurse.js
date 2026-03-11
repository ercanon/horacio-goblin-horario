import {
    SlashCommandBuilder,
    MessageFlags
} from "discord.js";
import msgHoracio from "../phrasesHoracio.json" with { type: 'json' };

export async function execute(interaction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const user = interaction.options.getUser("user");
    const content = `_${user} - #${interaction.options.getInteger("session")} Session._\n ${msgHoracio["goblinCurse"][Math.floor(Math.random() * msgHoracio["goblinCurse"].length)]} > ${msgHoracio["scheduleCurses"][Math.floor(Math.random() * msgHoracio["scheduleCurses"].length)]}`;

    try {
        await interaction.channel.send({ content });
        const sentMessage = await user.send(content);
        await sentMessage.pin();

        await interaction.editReply({
            content: `✅ Mensaje hablado para ${user.tag} con éxito!`,
            flags: [MessageFlags.Ephemeral],
        });
    }
    catch (error) {
        console.error("Error al enviar DM:", error);
        await interaction.editReply({
            content: `❌ No pude enviar el mensaje a ${user.tag}. Tal vez no quiere escuchar a Horacio...`,
            flags: [MessageFlags.Ephemeral],
        });
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName("goblin_curse") //Does not admit Caps
        .setDescription("Set curse to a player for the next session")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("Player to send DM")
                .setRequired(true)
        )
        .addIntegerOption((option) =>
            option
                .setName("session")
                .setDescription("The session when the curse will take effect")
                .setRequired(true)
        ),
    execute
};

