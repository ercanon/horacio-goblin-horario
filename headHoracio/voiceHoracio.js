const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { storeTimelapse, retrieveTimelapse } = require("./eyesHoracio.js");
const msgHoracio = require("./phrasesHoracio.json");

module.exports = class VoiceHoracio {
    #guild = null;
    #inrReminder = {};
    constructor(guild, app) {
        this.#guild = guild;
        const botRole = guild.members.me.roles.highest;

        app.post("/awake", (req, res) => {
            console.log("📡 ¡Horacio despierto, ojos abiertos, cerebro… casi!");
            return res.status(200).send("¡Horacio despierto, Horacio atento!");
        });

        app.post("/unableSession", async (req, res) => {
            const [channel, role] = await this.getRoleChannel(req.body);
            if (channel) {
                if (this.#inrReminder[channel.id])
                    clearInterval(this.#inrReminder[channel.id]);
                await storeTimelapse({
                    channelID: channel.id,
                    duration: 0,
                    type: "interval"
                });

                channel.send({
                    content: `${role} ${msgHoracio["unableSession"][Math.floor(Math.random() * msgHoracio["unableSession"].length)]}`,
                });
                return res.status(200).send("¡Horacio triste! No haber session.");
            }
            return res.status(400).send("¡Horacio confuso! ¿Session? Faltan ingredientes.");
        });

        app.post("/emptySchedule", async (req, res) => {
            const { channelID } = req.body;
            this.replyPinned("emptySchedule", channelID);

            const duration = 2 * 24 * 60 * 60 * 1000;
            this.#inrReminder[channelID] = setInterval(() =>
                this.replyPinned("remindSchedule", channelID),
                duration
            );
            await storeTimelapse({
                channelID,
                duration,
                type: "interval",
                actionData: {
                    action: "replyPinned",
                    data: ["remindSchedule", channelID]
                }
            });

            return res.status(200).send("¡Horacio avisó para horario!");
        });

        app.post("/notifySession", async (req, res) => {
            const [channel, role] = await this.getRoleChannel(req.body);
            if (channel) {
                if (this.#inrReminder[channel.id])
                    clearInterval(this.#inrReminder[channel.id]);
                await storeTimelapse({
                    channelID: channel.id,
                    duration: 0,
                    type: "interval"
                });

                const { dispDates, sessionNum } = req.body;
                const msMinSession = req.body.msMinSession - Date.now();
                const msgResult = `${role} #${sessionNum} Session: `;

                if (dispDates.length === 1) {
                    channel.send(msgResult + dispDates[0]);
                    this.editSchedule(dispDates[0], sessionNum, channel);
                }
                else if (dispDates.length > 1) {
                    try {
                        const duration = Math.min(
                            6 * 24 * 60 * 60 * 1000,
                            msMinSession
                        );

                        await channel.send({
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
                        await storeTimelapse({
                            channelID: channel.id,
                            duration: elapsedDuration,
                            type: "timeout",
                            actionData: {
                                action: "checkDayWinner",
                                data: [channel.id, msgResult, sessionNum]
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
                const lastMsgs = message.channel.messages.fetch({ limit: 26 })
                lastMsgs.forEach(async (msg) => {
                    if (!msgPattern.test(msg.content) && !msg.pinned && msg.deletable) {
                        await msg.delete().catch((error) =>
                            console.error("❌ ¡Bah! Mensaje terco, no se deja borrar. ¿Magia oscura?", error));
                    }
                });

                console.warn("⚠️ ¡Puf! Mensajes desaparecidos, como magia (o garra de Horacio).");
            }
        });

        guild.channels.cache
            .filter((channel) =>
                channel.type === ChannelType.GuildAnnouncement &&
                channel.permissionsFor(botRole)?.has(PermissionFlagsBits.SendMessages, false))
            .forEach(async (channel) => {
                const timelapseList = await retrieveTimelapse(channel.id);
                for (const { type, timeStart, duration, actionData } of timelapseList) {
                    switch (type) {
                        case "timeout":
                            const timeLeft = (timeStart + duration) - Date.now();
                            if (timeLeft <= 0)
                                continue;

                            console.log(`🕰 ¡Horacio recordando polls en ${channel.parent.name}! ...Cree`);
                            setTimeout(() =>
                                this[actionData.action](...actionData.data),
                                timeLeft,
                            );
                            break;

                        case "interval":
                            if (duration <= 0)
                                continue;

                            console.log(`🕰 ¡Horacio recordando reminders en ${channel.parent.name}! ...Cree`);
                            if (this.#inrReminder[channel.id])
                                clearInterval(this.#inrReminder[channel.id]);
                            this.#inrReminder[channel.id] = setInterval(() =>
                                this[actionData.action](...actionData.data),
                                duration
                            );
                            break;
                    }
                }
            });
    }

    async replyPinned(phraseType, channelID) {
        const [channel, role] = await this.getRoleChannel({ channelID });
        if (channel) {
            const pinnedMsg = await channel.messages.fetchPinned();
            channel.send({
                content: `${role} ${msgHoracio[phraseType][Math.floor(Math.random() * msgHoracio[phraseType].length)]}`,
                reply: {
                    messageReference: pinnedMsg?.last().id,
                    failIfNotExists: false
                }
            });
        }
    }
    async checkDayWinner(channelID, msgResult, sessionNum) {
        const [channel, role] = await this.getRoleChannel({ channelID });
        if (channel) {
            const lastMsgs = await channel.messages.fetch({ limit: 6 })
            const msgPoll = lastMsgs.find((msg) =>
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

        const startTime = new Date(Date.UTC(year, month - 1, day, startHour, startMinute || 0) + 60 * 60 * 1000); // UTC+1
        const endTime   = new Date(Date.UTC(year, month - 1, day, endHour, endMinute || 0) + 60 * 60 * 1000); // UTC+1

        if (endTime <= startTime)
            endTime.setUTCDate(endTime.getUTCDate() + 1);

        console.log(startTime.toISOString() + "\n" + endTime.toISOString())

        await this.#guild.scheduledEvents.edit(eventID, {
            name: `#${sessionNum} Session`,
            scheduledStartTime: startTime,
            scheduledEndTime: endTime
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
