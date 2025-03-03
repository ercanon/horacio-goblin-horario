module.exports = (client) => {
    const msgHoracio = require("./phrasesHoracio.json");
    const express = require("express");
    const app = express();

    const channelData = new Map();

    app.use(express.json());
    app.listen(3000, () =>
        console.log("🌍 ¡Horacio ahora atrapa datos! Horacio atento."),
    );

    app.post("/awake", (req, res) => {
        console.log("📡 ¡Horacio despierto, ojos abiertos, cerebro… casi!");
        return res.status(200).send("¡Horacio despierto, Horacio atento!");
    });

    app.post("/emptySchedule", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            const firstMsg = await data.channel.messages.fetch({ limit: 1 })
                .then((messages) =>
                    messages.first());
            await data.channel.send({
                constent: `${data.role} ${msgHoracio.emptySchedule[Math.floor(Math.random() * msgHoracio.emptySchedule.length)]}\n${firstMsg}`,
                reply: {
                    messageReference: firstMsg.id,
                    failIfNotExists: false
                }
            });
            return res.status(200).send("¡Horacio avisó para horario!");
        }
        return res.status(400).send("¡Horacio no avisó! Faltan ingredientes.");
    });

    app.post("/notifySession", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            const dispDates = req.body.dispDates;
            if (dispDates?.length === 1)
                await data.channel.send(`${data.role} #${req.body.sessionNum} Sesión: ${dispDates[0]}`);
            else if (dispDates?.length > 1) {
                try {
                    const rmngTime = req.body.msNextSession;

                    await data.channel.send(`${data.role}`);
                    const msgPoll = await data.channel.send({
                        poll: {
                            question: { text: msgHoracio.pollQuestion[Math.floor(Math.random() * msgHoracio.pollQuestion.length)] },
                            answers: dispDates.map((date) =>
                                ({ text: date })),
                            allowMultiselect: true,
                            duration: Math.min(
                                1, //TODO: Testing, delete
                                4 * 24,
                                (rmngTime - Date.now()) / (60 * 60 * 1000) // ms each h
                            )
                        }
                    })

                    const intervalId = setInterval(async () => {
                        if (!msgPoll.poll?.resultsFinalized)
                            return console.warn("⚠️ ¡Aguanta! Poll no terminó... Horacio probará en un minuto.")

                        const winningOption = msgPoll.poll.answers.reduce((prev, current) =>
                            (prev.votes > current.votes) ? prev : current);
                        await msgPoll.channel.send(`${data.role} #${req.body.sessionNum} Sesión: ${winningOption.text}`);

                        clearInterval(intervalId);
                    }, 12 * 60 * 60 * 1000);
                }
                catch (error) {
                    console.error("❌ Horacio intentó, pero encuesta dijo 'no'.", error);
                }
            }
            return res.status(200).send("¡Horacio notificó sesión!");
        }
        return res.status(400).send("¡Horacio no notificó sesión! Faltan ingredientes.");
    });

    const msgPattern = /^@\S+ #\d+ Sesión: .+$/;
    client.on("messageCreate", async (message) => {
        if (message.channel.permissionsFor(client.user.id) && msgPattern.test(message.content)) {
            const messages = await message.channel.messages.fetch({ limit: 15 });
            messages.forEach(async (msg) => {
                if (!msgPattern.test(msg.content) && msg.deletable) {
                    msg.delete().catch((error) => 
                        console.error("❌ ¡Bah! Mensaje terco, no se deja borrar. ¿Magia oscura?", error));
                }
            });

        }
    });

    async function getRoleChannel(data) {
        if (data) {
            const channel = data.channelID
                ? await client.channels.fetch(data.channelID)
                : null;
            if (channel) {
                const categoryName = channel.parent?.name;
                return {
                    channel,
                    role: channel.guild.roles.cache.find((role) =>
                        role.name === categoryName),
                };
            }
        }
        return null;
    }
};
