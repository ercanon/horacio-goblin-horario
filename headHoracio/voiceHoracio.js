module.exports = (client) => {
    const { PermissionFlagsBits } = require("discord.js");
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

    app.post("/remindSchedule", async (req, res) => {
        try {
            let intervalID = null;
            if (!req.body)
                intervalID = setInterval(() =>
                    data.channel.send({
                        content: { text: msgHoracio.remindSchedule[Math.floor(Math.random() * msgHoracio.pollQuestion.length)] }
                    }), 2 * 24 * 60 * 60 * 1000);
            else
                clearInterval(req.body);

            return res.status(200).send(intervalID ? `intervalID=${intervalID}` : "¡Sí sí! Horacio recordará el horario… ¡o eso cree!");
        }
        catch (error) {
            return res.status(400).send(`Horacio olvidó recordar… o recordó olvidar… ¡ay!\n${error}`);
        }
    });

    app.post("/emptySchedule", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            const firstMsg = await data.channel.messages.fetch({ limit: 1 })
                .then((messages) =>
                    messages.first());
            await data.channel.send({
                content: `${data.role} ${msgHoracio.emptySchedule[Math.floor(Math.random() * msgHoracio.emptySchedule.length)]}\n${firstMsg}`,
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
            const { dispDates, sessionNum } = req.body;
            const msMinSession = req.body.msMinSession - Date.now();
            const msgResult = `${data.role} #${sessionNum} Session: `;

            if (dispDates.length === 1 || msMinSession <= 4 * 24 * 60 * 60 * 1000) {
                data.channel.send(msgResult + dispDates[0]);
                editSchedule(dispDates[0], sessionNum, data);
            }
            else if (dispDates.length > 1) {
                try {
                    const duration = Math.min(
                        5 * 24 * 60 * 60 * 1000,
                        msMinSession
                    );

                    const msgPoll = await data.channel.send({
                        content: `${data.role}`,
                        poll: {
                            question: { text: msgHoracio.pollQuestion[Math.floor(Math.random() * msgHoracio.pollQuestion.length)] },
                            answers: dispDates.map((date) =>
                                ({ text: date })),
                            allowMultiselect: true,
                            duration: duration / (60 * 60 * 1000)
                        }
                    });
                    setTimeout(() => {
                        const winningOption = msgPoll.poll.answers.reduce((prev, current) =>
                            (prev.votes > current.votes) ? prev : current);

                        data.channel.send(msgResult + winningOption.text);
                        editSchedule(winningOption.text, sessionNum, data);
                    }, duration + 60 * 1000);

                }
                catch (error) {
                    console.error("❌ Horacio intentó, pero encuesta dijo 'no'.", error);
                }
            }
            return res.status(200).send("¡Horacio notificó sesión!");
        }
        return res.status(400).send("¡Horacio no notificó sesión! Faltan ingredientes.");
    });

    async function editSchedule(dateString, sessionNum, data) {
        const scheduledEvents = await data.channel.guild.scheduledEvents.fetch();
        const eventID = scheduledEvents.find((event) =>
            event.entityMetadata?.location?.toLowerCase() === data.role.name.toLowerCase());

        if (!eventID)
            return console.error("❌ ¡Nada de evento! ¿se lo comió un dragón?");

        const year = new Date().getFullYear();
        const [day, month, startHour, startMinute, endHour, endMinute] = dateString
        .match(/\d+/g)
        .map(Number);

        const scheduledStartTime = new Date(year, month - 1, day, startHour - 1, startMinute || 0);
        const scheduledEndTime   = new Date(year, month - 1, day, endHour - 1, endMinute || 0);

        if (endDate <= startDate)
            endDate.setDate(endDate.getDate() + 1);

        await data.channel.guild.scheduledEvents.edit(eventID, {
            name: `#${sessionNum} Session`,
            scheduledStartTime,
            scheduledEndTime
        });
    }

    const msgPattern = /^<@!?&?\d+> #\d+ Session: .+$/;
    client.on("messageCreate", async (message) => {
        if (message.channel.permissionsFor(process.env.CLIENT_ID).has(PermissionFlagsBits.SendMessages) && msgPattern.test(message.content)) {
            message.channel.messages.fetch({ limit: 10 }).then((lastMsgs) =>
                lastMsgs.forEach(async (msg) => {
                    if (!msgPattern.test(msg.content) && !msg.pinned && msg.deletable) {
                        await msg.delete().catch((error) =>
                            console.error("❌ ¡Bah! Mensaje terco, no se deja borrar. ¿Magia oscura?", error));
                    }
                })
            );

            console.warn("⚠️ ¡Puf! Mensajes desaparecidos, como magia (o garra de Horacio).");
        }
    });

    async function getRoleChannel(data) {
        if (data) {
            const channel = data.channelID
                ? await client.channels.fetch(data.channelID)
                : null;
            if (channel) {
                const categoryName = channel.parent?.name.toLowerCase();
                return {
                    channel,
                    role: channel.guild.roles.cache.find((role) =>
                        role.name.toLowerCase() === categoryName),
                };
            }
        }
        return null;
    }
};
