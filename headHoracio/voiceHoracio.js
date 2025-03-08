module.exports = (guild) => {
    const {
        ChannelType,
        PermissionFlagsBits
    } = require("discord.js");
    const { storeTimelapse, retrieveTimelapse } = require("./eyesHoracio.js")
    const botRole = guild.members.me.roles.highest;
    const msgHoracio = require("./phrasesHoracio.json");

    const express = require("express");
    const app = express();

    app.use(express.json());
    const tryPort = (port) => {
        app.listen(port, () => {
            console.log(`🌍 ¡Horacio ahora atrapa datos para ${guild.name}! Horacio atento en el puerto ${port}.`);
        }).on("error", (error) => {
            if (error.code === "EADDRINUSE")
                tryPort(port + 1);
        });
    };
    tryPort(3000); 

    app.post("/awake", (req, res) => {
        console.log("📡 ¡Horacio despierto, ojos abiertos, cerebro… casi!");
        return res.status(200).send("¡Horacio despierto, Horacio atento!");
    });

    app.post("/unableSession", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            data.channel.send({
                content: `${data.role} ${msgHoracio[unableSession][Math.floor(Math.random() * msgHoracio[unableSession].length)]}`,
            });
            return res.status(200).send("¡Horacio triste! No haber session");
        }
        return res.status(400).send("¡Horacio confuso! ¿Session? Faltan ingredientes.");
    });

    app.post("/emptySchedule", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            const duration = 2 * 24 * 60 * 60 * 1000
            const id = setInterval(
                replyPinned,
                duration,
                "remindSchedule", data);
            //await storeTimelapse(duration, data.channel.id, {
            //    id,
            //    type: "interval",
            //    action: "replyPinned",
            //    data: ["remindSchedule", data]
            //});

            await replyPinned("emptySchedule", data);
            return res.status(200).send("¡Horacio avisó para horario!");
        }
        return res.status(400).send("¡Horacio no avisó! Faltan ingredientes.");
    });
    async function replyPinned(phrases, data) {
        const pinnedMsg = await data.channel.messages.fetchPinned();
        data.channel.send({
            content: `${data.role} ${msgHoracio[phrases][Math.floor(Math.random() * msgHoracio[phrases].length)]}`,
            reply: {
                messageReference: pinnedMsg?.last().id,
                failIfNotExists: false
            }
        });
    }

    app.post("/notifySession", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            const { dispDates, sessionNum } = req.body;
            const msMinSession = req.body.msMinSession - Date.now();
            const msgResult = `${data.role} #${sessionNum} Session: `;

            clearInterval(await retrieveTimelapse(data.channel.id).actionData.id);
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

                    const elapseDuration = duration + 60 * 1000;
                    const id = setTimeout(
                        checkDayWinner,
                        elapseDuration,
                        msgPoll.poll.answers, msgResult, sessionNum, data);
                    //await storeTimelapse(elapseDuration, data.channel.id, {
                    //    id,
                    //    type: "timelapse",
                    //    action: "replyPinned",
                    //    data: [msgPoll.poll.answers, msgResult, sessionNum, data]
                    //});
                }
                catch (error) {
                    console.error("❌ Horacio intentó, pero encuesta dijo 'no'.", error);
                }
            }
            return res.status(200).send("¡Horacio notificó sesión!");
        }
        return res.status(400).send("¡Horacio no notificó sesión! Faltan ingredientes.");
    });
    function checkDayWinner(answers, msgResult, sessionNum, data) {
        const winningOption = answers.reduce((prev, current) =>
            (prev.votes > current.votes) ? prev : current);

        data.channel.send(msgResult + winningOption.text);
        editSchedule(winningOption.text, sessionNum, data);
    }

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
    guild.client.on("messageCreate", async (message) => {
        if (message.guild.id !== guild.id &&
            message.channel.permissionsFor(botRole)?.has(PermissionFlagsBits.SendMessages, false) &&
            msgPattern.test(message.content)) {
            message.channel.messages.fetch({ limit: 26 }).then((lastMsgs) =>
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

    guild.channels.cache
        .filter((channel) =>
            channel.type === ChannelType.GuildAnnouncement &&
            channel.permissionsFor(botRole)?.has(PermissionFlagsBits.SendMessages, false))
        .forEach((channel) => {
            retrieveTimelapse(channel.id).then((dbData) => {
                if (!dbData)
                    return;

                const { timeStart, duration, actionID, actionType, actionData } = dbData;
                let id = null;
                switch (actionType) {
                    case "interval":
                        console.log(`🕰 ¡Horacio recordando horarios en ${channel.name}! ¡Horacio atento!`);
                        id = setInterval(
                            actionData.action,
                            duration,
                            ...(actionData.data));
                        break;
                    case "timeout":
                        console.log(`🕰 ¡Horacio recordando polls en ${channel.name}! ...Cree`);
                        const timeLeft = duration - Date.now() - timeStart;
                        if (timeLeft < 0)
                            return;

                        id = setTimeout(
                            actionData.action,
                            timeLeft,
                            ...(actionData.data));
                        break;
                }

                if (id)
                    storeTimelapse({
                        ...dbData,
                        actionID: id
                    });
            });
        });

    async function getRoleChannel(data) {
        if (data) {
            const channel = data.channelID
                ? await guild.channels.fetch(data.channelID)
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
