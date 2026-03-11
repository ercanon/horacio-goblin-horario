import {
    Client,
    GatewayIntentBits,
    Collection,
    REST,
    Routes,
    MessageFlags
} from "discord.js";
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
import express from "express";

const app = express();
app.use(express.json());

const port = process.env.PORT || 10000;
app.listen(port, () => {
    console.log(`🌍 ¡Horacio ahora atrapa datos! Horacio atento en el puerto ${port}.`);
}).on("error", (error) =>
    console.error(`❌ Error atrapando datos.`, error));

client.login(process.env.TOKEN).catch((error) => 
    console.error(` ❌ Horacio no puede entrar a Discord. Revisa mi TOKEN.`, error));

/*>--------------- { Commands } ---------------<*/
client.commands = new Collection();
import fs from "fs";
const commandFiles = fs.readdirSync("./headHoracio/actionsHoracio")
    .filter((file) => file.endsWith(".js"));

const body = [];
(async () => {
    for (const file of commandFiles) {
        const cmdModule = await import(`./actionsHoracio/${file}`);
        const cmd = cmdModule.default || cmdModule;
        client.commands.set(cmd.data.name, cmd);
        body.push(cmd.data.toJSON());
    }

    try {
        const cleanBody = body.map(cmd => {
            if (typeof cmd.toJSON === 'function') {
                return cmd.toJSON();
            }
            return cmd;
        });

        console.log("body:", cleanBody);
        const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
        console.log("rest:", rest);
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body });
        console.log("📤 ¡Horacio pone comandos, sí sí! Slash, slash, mucho orden, no explotar.");
    }
    catch (error) {
        console.error("❌ ¡Agh! Comandos pelean con Horacio. No quieren registrarse. Magia mala, muy mala.", error);
    };
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
import VoiceHoracio from "./voiceHoracio.js";
client.on("guildCreate", (guild) =>
    new VoiceHoracio(guild));

/*>--------------- { Bot Initialization } ---------------<*/
client.once("ready", async () => {
    client.guilds.cache.forEach((guild) =>
        new VoiceHoracio(guild, app));
    console.log(`✅ Horacio está, ¡sí sí! ¡Conectado, todo listo!`);
});