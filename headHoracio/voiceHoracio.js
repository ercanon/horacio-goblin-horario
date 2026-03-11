import { ChannelType, PermissionFlagsBits } from "discord.js";
import { storeTimelapse, retrieveTimelapse } from "./eyesHoracio.js";
import { msgPattern, execute } from "./actionsHoracio/clearReminders.js";
import msgHoracio from "./phrasesHoracio.json" with { type: 'json' };;

export default class VoiceHoracio {
    #guild = null;
    #inrReminder = {};
    constructor(guild, app) {
        this.#guild = guild;
        const botRole = guild.roles.cache.find((role) =>
            role.tags?.botId);

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
                    duration: -1,
                    type: "null",
                    actionData: {}
                });

                channel.send(`${role} ${msgHoracio["unableSession"][Math.floor(Math.random() * msgHoracio["unableSession"].length)]}`);
                return res.status(200).send("¡Horacio triste! No haber session.");
            }
            return res.status(400).send("¡Horacio confuso! ¿Session? Faltan ingredientes.");
        });

        app.post("/emptySchedule", async (req, res) => {
            const { channelID, initDate } = req.body;
            this.replyPinned("emptySchedule", channelID, `Semana del ${initDate}.\n`);

            const duration = 2 * 24 * 60 * 60 * 1000;
            const actionData = {
                action: "replyPinned",
                    data: ["remindSchedule", channelID]
            }
            await storeTimelapse({
                channelID,
                duration,
                type: "interval",
                actionData
            });
            this.#inrReminder[channelID] = setInterval(async () =>
                await this.intervalHdl(channelID, actionData),
                duration
            );

            return res.status(200).send("¡Horacio avisó para horario!");
        });

        app.post("/notifySession", async (req, res) => {
            const [channel, role] = await this.getRoleChannel(req.body);
            if (channel) {
                if (this.#inrReminder[channel.id])
                    clearInterval(this.#inrReminder[channel.id]);

                const { availDates, sessionNum, msMinSession } = req.body;
                const msgResult = `${role} #${sessionNum} Session: `;

                if (availDates.length === 1) {
                    channel.send(msgResult + availDates[0]);
                    this.editEvent(availDates[0], sessionNum, channel);
                }
                else if (availDates.length > 1) {
                    try {
                        const duration = Math.min(
                            5 * 24 * 60 * 60 * 1000,
                            msMinSession - Date.now()
                        );

                        await channel.send({
                            content: `${role}`,
                            poll: {
                                question: { text: msgHoracio.pollQuestion[Math.floor(Math.random() * msgHoracio.pollQuestion.length)] },
                                answers: availDates.map((date) =>
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

        guild.client.on("messageCreate", async (message) => {
            if (message.guild.id === guild.id &&
                msgPattern.test(message.content)) {
                execute({
                    channel: message.channel,
                    options: { getInteger: () => 26 },
                    botRole,
                    editReply(info) { console.log(info.content) },

                });
            }
        });

        guild.channels.cache
            .filter((channel) =>
                channel.type === ChannelType.GuildAnnouncement &&
                channel.permissionsFor(botRole)?.has(PermissionFlagsBits.SendMessages))
            .forEach(async (channel) => {
                const timelapseList = await retrieveTimelapse(channel.id);
                for (const { type, timeStart, duration, actionData } of timelapseList) {
                    const timeLeft = (timeStart + duration) - Date.now();
                    switch (type) {
                        case "timeout":
                            console.log(`🕰 ¡Horacio recordando polls en ${channel.parent.name}! ...Cree`);
                            setTimeout(() =>
                                this[actionData.action](...actionData.data),
                                timeLeft
                            );
                            break;

                        case "interval":
                            if (timeLeft <= 0)
                                this[actionData.action](...actionData.data);

                            console.log(`🕰 ¡Horacio recordando reminders en ${channel.parent.name}! ...Cree`);
                            if (this.#inrReminder[channel.id])
                                clearInterval(this.#inrReminder[channel.id]);
                            this.#inrReminder[channel.id] = setInterval(async () =>
                                await this.intervalHdl(channel.id, actionData),
                                duration
                            );
                            break;
                        default:
                            continue;
                    }
                }
            });
    }

    async replyPinned(phraseType, channelID, extraMsg = "") {
        const [channel, role] = await this.getRoleChannel({ channelID });
        if (channel) {
            const pinnedMsg = await channel.messages.fetchPinned();
            channel.send({
                content: `${role} ${extraMsg}${msgHoracio[phraseType][Math.floor(Math.random() * msgHoracio[phraseType].length)]}`,
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
            this.editEvent(winningOption.text, sessionNum, channel);
        }
    }
    async editEvent(dateString, sessionNum, channel) {
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

        const startTime = new Date(year, month - 1, day, startHour - 1, startMinute || 0);
        const endTime = new Date(year, month - 1, day, endHour - 1, endMinute || 0);

        if (endTime <= startTime)
            endTime.setUTCDate(endTime.getUTCDate() + 1);

        console.log(`UTC: ${startTime.toISOString()}h - ${endTime.toISOString()}h\nLocal: ${startTime.toString()}h - ${endTime.toString()}h`);
        await storeTimelapse({
            channelID: channel.id,
            duration: -1,
            type: "null",
            actionData: {}
        });

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

    async intervalHdl(channelID, { action, data }) {
        this[action](...data)
        await storeTimelapse({ channelID });
    }
};
