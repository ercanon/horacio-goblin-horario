module.exports = (client) => {
    const express = require("express");
    const app = express();

    app.use(express.json());
    app.listen(3000, () =>
        console.log("🌍 ¡Sí sí! Horacio ahora recibe datos, espero que no exploten."),
    );

    app.post("/awake", (req, res) => {
        console.log("📡 ¡Horacio despierto, ojos abiertos, cerebro… casi!");
        return res.status(200).send("¡Horacio atento!");
    });

    app.post("/emptySchedule", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            await data.channel.send(`${data.role} ¡Horacio preparado para apuntar! Nueva sesión, ¡si si!`);
            return res.status(200).send("¡Horacio avisó para horario!");
        }
        return res.status(400).send("¡Horacio no avisó! Faltan ingredientes.");
    });

    app.post("/notifySession", async (req, res) => {
        const data = await getRoleChannel(req.body);
        if (data) {
            const datesDisp = req.body.datesDisp;
            if (datesDisp?.length === 1)
                await data.channel.send(`@${data.role} #${req.body.sessionNum} Sesión: ${datesDisp[0]}`);
            else if (datesDisp?.length > 1) {
                await data.channel.send({
                    poll: {
                        question: "",
                    },
                });
            }
            return res.status(200).send("¡Horacio notificó sesión!");
        }
        return res.status(400).send("¡Horacio no notificó sesión! Faltan ingredientes.");
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
