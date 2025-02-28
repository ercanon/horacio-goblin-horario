const {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
} = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
require('./voiceHoracio.js')(client);

client.commands = new Collection();
const commandFiles = require("fs")
    .readdirSync("./actionsHoracio")
    .filter((file) => file.endsWith(".js"));

const commands = [];
for (const file of commandFiles) {
    const cmd = require(`./actionsHoracio/${file}`);
    client.commands.set(cmd.data.name, cmd);
    commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env["TOKEN"]);

(async () => {
    try {
        console.log("📤 ¡Horacio pone comandos, sí sí! Slash, slash, mucho orden, mucho poder.");

        await rest.put(Routes.applicationCommands(process.env["CLIENT_ID"]), {
            body: commands,
        });

        console.log("✅ Comandos hechos. No romper, no explotar. Horacio vigila.");
    } catch (error) {
        console.error("❌ ¡Agh! Comandos pelean con Horacio. No quieren registrarse. Magia mala, muy mala.", error);
    }
})();

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    console.log("Comando recibido: ", interaction.commandName);

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    try {
        await cmd.execute(interaction);
    } catch (error) {
        console.error(error);
        if (!interaction.replied)
            await interaction.reply({
                content: "❌ ¡Bah! Comando no funciona. Horacio lo intentó... paciencia.",
                flags: [MessageFlags.Ephemeral],
            });
    }
});

client.once("ready", () => {
    console.log(`✅ Horacio está, ¡sí sí! ¡Conectado, listo todo!`);
});

client.login(process.env.TOKEN);
