const axios = require("axios");

module.exports = {
    async setSchedule(sheetName, channelID) {
        try {
            const response = await axios.post(process.env.GAS_URL, { sheetName, channelID });
    
            if (response.data.success)
                return response.data.sheetId;
            throw new Error(response.data.error);
        }
        catch (error) {
            console.error("Horacio no sabe d�nde est�n horarios� �Todo hecho l�o!", error);
            throw error;
        }
    }
}