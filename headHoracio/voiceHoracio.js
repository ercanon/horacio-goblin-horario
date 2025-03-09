const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { storeTimeout, retrieveTimeout } = require("./eyesHoracio.js");
const msgHoracio = require("./phrasesHoracio.json");
const express = require("express");

module.exports = class VoiceHoracio {
    #guild = null;
    #msgPoll = null;
    constructor(guild) {
        this.#guild = guild;
        const botRole = guild.members.me.roles.highest;
        const app = express();

        app.use(express.json());
        const tryPort = (port) => {
            app.listen(port, () => {
                console.log(`🌍 ¡Horacio ahora atrapa datos para ${guild.name}! Horacio atento en el puerto ${port}.`);
            }).on("error", (error) => {
                if (error.code === "EADDRINUSE")
                    tryPort(port + 1);
                else
                    console.error(`❌ Error atrapando datos para ${guild.name}.`, error);
            });
        };
        tryPort(3000);

        app.post("/awake", (req, res) => {
            console.log("📡 ¡Horacio despierto, ojos abiertos, cerebro… casi!");
            return res.status(200).send("¡Horacio despierto, Horacio atento!");
        });

        app.post("/unableSession", async (req, res) => {
            const [channel, role] = await this.getRoleChannel(req.body);
            if (channel) {
                channel.send({
                    content: `${role} ${msgHoracio["unableSession"][Math.floor(Math.random() * msgHoracio["unableSession"].length)]}`,
                });
                return res.status(200).send("¡Horacio triste! No haber session.");
            }
            return res.status(400).send("¡Horacio confuso! ¿Session? Faltan ingredientes.");
        });

        app.post("/replyPinned", async (req, res) => {
            const [channel, role] = await this.getRoleChannel(req.body);
            if (channel) {
                const pinnedMsg = await channel.messages.fetchPinned();
                const phraseType = req.body.phraseType;
                channel.send({
                    content: `${role} ${msgHoracio[phraseType][Math.floor(Math.random() * msgHoracio[phraseType].length)]}`,
                    reply: {
                        messageReference: pinnedMsg?.last().id,
                        failIfNotExists: false
                    }
                });
                return res.status(200).send("¡Horacio avisó para horario!");
            }
            return res.status(400).send("¡Horacio no avisó! Faltan ingredientes.");
        });

        app.post("/notifySession", async (req, res) => {
            const [channel, role] = await this.getRoleChannel(req.body);
            if (channel) {
                const { dispDates, sessionNum } = req.body;
                const msMinSession = req.body.msMinSession - Date.now();
                const msgResult = `${role} #${sessionNum} Session: `;

                if (dispDates.length === 1 || msMinSession <= 4 * 24 * 60 * 60 * 1000) {
                    channel.send(msgResult + dispDates[0]);
                    this.editSchedule(dispDates[0], sessionNum, channel);
                }
                else if (dispDates.length > 1) {
                    try {
                        const duration = Math.min(
                            1 * 60 * 60 * 1000, //TODO Delete
                            5 * 24 * 60 * 60 * 1000,
                            msMinSession
                        );

                        this.#msgPoll = await channel.send({
                            content: `${role}`,
                            poll: {
                                question: { text: msgHoracio.pollQuestion[Math.floor(Math.random() * msgHoracio.pollQuestion.length)] },
                                answers: dispDates.map((date) =>
                                    ({ text: date })),
                                allowMultiselect: true,
                                duration: duration / (60 * 60 * 1000)
                            }
                        });

                        const elapsedDuration = duration + 60 * 1000;
                        setTimeout(() =>
                            this.checkDayWinner(channel.id, msgResult, sessionNum),
                            elapsedDuration
                        );
                        await storeTimeout({
                            channelID: channel.id,
                            duration: elapsedDuration,
                            type: "timeout",
                            actionData: {
                                action: "checkDayWinner",
                                data: JSON.stringify([channel.id, msgResult, sessionNum])
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
                retrieveTimeout(channel.id, "timeout").then((dbData) => {
                    if (!dbData)
                        return;

                    console.log(`🕰 ¡Horacio recordando polls en ${channel.name}! ...Cree`);
                    const { timeStart, duration, actionData } = dbData;
                    const timeLeft = duration - Date.now() - timeStart;

                    if (timeLeft < 0)
                        return;
                    setTimeout(() =>
                        this[actionData.action](...(actionData.data)),
                        timeLeft,
                    );
                });
            });
    }

    async checkDayWinner(channelID, msgResult, sessionNum) {
        const [channel, role] = await this.getRoleChannel({channelID});
        if (channel) {
            const msgPoll = channel.messages.fetch({ limit: 6 }).find((msg) =>
                msg.poll)

            const winningOption = msgPoll.poll.answers.reduce((prev, current) =>
                prev.votes > current.votes ? prev : current);

            channel.send(msgResult + winningOption.text);
            this.editSchedule(winningOption.text, sessionNum, channel);
        }
    }
    async editSchedule(dateString, sessionNum, channel) {
        const scheduledEvents = await this.#guild.scheduledEvents.fetch();
        const categoryName = channel.parent?.name.toLowerCase();
        const eventID = scheduledEvents.find((event) =>
            event.entityMetadata?.location?.toLowerCase() === categoryName);

        if (!eventID)
            return console.error("❌ ¡Nada de evento! ¿se lo comió un dragón?");

        const year = new Date().getFullYear();
        const [, day, month, startHour, startMinute, endHour, endMinute] = dateString
            .match(/(\d+)\/(\d+), (\d+):?(\d*)h-(\d+):?(\d*)h/)
            .map(Number);

        const startTime = new Date(Date.UTC(year, month - 1, day, startHour, startMinute || 0));
        const endTime   = new Date(Date.UTC(year, month - 1, day, endHour, endMinute || 0));

        if (endTime <= startTime)
            endTime.setUTCDate(endTime.getUTCDate() + 1);

        console.log(startTime.toISOString() + "\n" + endTime.toISOString())

        await this.#guild.scheduledEvents.edit(eventID, {
            name: `#${sessionNum} Session`,
            scheduledStartTime: startTime.getTime(),
            scheduledEndTime: endTime.getTime()
        });
    }
    async getRoleChannel({ channelID }) {
        try {
            if (channelID) {
                const channel = await this.#guild.channels.fetch(channelID);
                if (channel) {
                    const categoryName = channel.parent?.name.toLowerCase();
                    return [
                        channel,
                        this.#guild.roles.cache.find((role) =>
                            role.name.toLowerCase() === categoryName),
                    ];
                }
            }
            throw new Error("Channel not defined");
        }
        catch (error) {
            console.error("❌ ¡Canal desaparecido! ¿Lo robó un elfo o algo?", error);
            return [];
        }
    }   
};
