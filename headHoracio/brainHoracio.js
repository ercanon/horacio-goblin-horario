const {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
    MessageFlags
} = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

/*>--------------- { Commands } ---------------<*/
client.commands = new Collection();
const commandFiles = require("fs")
    .readdirSync("./headHoracio/actionsHoracio")
    .filter((file) => file.endsWith(".js"));

const body = [];
for (const file of commandFiles) {
    const cmd = require(`./actionsHoracio/${file}`);
    client.commands.set(cmd.data.name, cmd);
    body.push(cmd.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
        console.log("📤 ¡Horacio pone comandos, sí sí! Slash, slash, mucho orden, no explotar.");
    }
    catch (error) {
        console.error("❌ ¡Agh! Comandos pelean con Horacio. No quieren registrarse. Magia mala, muy mala.", error);
    }
})();

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand())
        return;
    console.log(`¡Entiendo Comando, Horacio hace ${interaction.commandName}!`);

    const cmd = client.commands.get(interaction.commandName);
    if (!cmd)
        return;

    try {
        await cmd.execute(interaction);
    }
    catch (error) {
        console.error(error);
        if (!interaction.replied)
            await interaction.reply({
                content: "❌ ¡Bah! Comando no funciona. Horacio lo intentó... paciencia.",
                flags: [MessageFlags.Ephemeral],
            });
    }
});

/*>--------------- { Guilds } ---------------<*/
const VoiceHoracio = require("./voiceHoracio.js");
client.on("guildCreate", (guild) =>
    new VoiceHoracio(guild));

/*>--------------- { Bot Initialization } ---------------<*/
client.once("ready", () => {
    client.guilds.cache.forEach((guild) =>
        new VoiceHoracio(guild));
    console.log(`✅ Horacio está, ¡sí sí! ¡Conectado, todo listo!`);
});

client.login(process.env.TOKEN);
