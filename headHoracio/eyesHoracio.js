const axios = require("axios");

module.exports = {
    async setSchedule(sheetName, tabColor, channelID) {
        try {
            const response = await axios.post(process.env.GAS_URL, {
                postType: "setSchedule",
                channelID,
                sheetName,
                tabColor
            });
    
            if (response.data.success)
                return response.data.sheetId;
            throw new Error(response.data.error);
        }
        catch (error) {
            console.error("Horacio no sabe dónde están horarios… ¡Todo hecho lío!", error);
            throw error;
        }
    }, 
    async storeTimelapse(data) {
        try {
            const response = await axios.post(process.env.GAS_URL, {
                postType: "storeTimelapse",
                timeStart: Date.now(),
                ...data
            });

            if (!response.data.success)
                throw new Error(response.data.error);
        }
        catch (error) {
            console.error("¡Horacio no sabe guardar esos… cómo se llamen! ¡Tiempos saltados o algo así!", error);
            throw error;
        }
    },
    async retrieveTimelapse(channelID) {
        try {
            const response = await axios.post(process.env.GAS_URL, {
                postType: "retrieveTimelapse",
                channelID
            });

            if (response.data.success)
                return response.data.dataTimelapse;
            throw new Error(response.data.error);
        }
        catch (error) {
            console.error("¡Horacio no ve esos tiempos saltados! ¿Dónde se metieron, eh?", error);
            throw error;
        }
    }
}