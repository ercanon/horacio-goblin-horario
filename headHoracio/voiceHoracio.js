module.exports = (client) => {
    const msgHoracio = require("./phrasesHoracio.json");
    const express = require("express");
    const app = express();

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
            const msNextSession = req.body.msNextSession - Date.now();
            const msgResult = `${data.role} #${req.body.sessionNum} Sesión: `;
            if (dispDates?.length === 1 || msNextSession <= 48 * 60 * 60 * 1000)
                await data.channel.send(msgResult + dispDates[0]);
            else if (dispDates?.length > 1) {
                try {
                    const msgPoll = await data.channel.send({
                        content: data.role,
                        poll: {
                            question: { text: msgHoracio.pollQuestion[Math.floor(Math.random() * msgHoracio.pollQuestion.length)] },
                            answers: dispDates.map((date) =>
                                ({ text: date })),
                            allowMultiselect: true,
                            duration: Math.min(
                                1, //TODO: Testing, delete
                                5 * 24,
                                msNextSession / (60 * 60 * 1000) // ms each h
                            )
                        }
                    });

                    msgPoll.poll = new Proxy(msgPoll.poll, {
                        set(target, prop, value) {
                            if (prop === "resultsFinalized" && value === true) {
                                console.log("📌 Detectado cambio en resultsFinalized!");

                                const winningOption = target.answers.reduce((prev, current) =>
                                    (prev.votes > current.votes) ? prev : current);
                                
                                target.channel.send(msgResult + winningOption.text);
                            }
                            console.log("prop: " + prop + ", value: " + value)
                            target[prop] = value;
                            return true;
                        }
                    });
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
