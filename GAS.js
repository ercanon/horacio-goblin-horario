/*>--------------- { Global Variables } ---------------<*/
const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
const scriptProps = PropertiesService.getScriptProperties();
const docProps = PropertiesService.getDocumentProperties();
const timelapseSheet = spreadsheet.getSheetByName("storeTimelapse");

const minNotice = 2 * 24 * 60 * 60 * 1000;
const excludedSheetIds = [1514802129, 848260242];
const times = ["9:30h-13h", "16h-20h", "20:30h-0h"];
const url = "https://horacio-el-goblin-horario.onrender.com/";

/*>--------------- { Trigger Functions } ---------------<*/
function onCellEdit(e) {
    const nameSheet = e.source.getActiveSheet().getName();

    if (parseInt(scriptProps.getProperty(`${nameSheet}_state`)) >= 0)
        scriptProps.setProperty(`${nameSheet}_state`, 1);
    Logger.log(`Hoja ${nameSheet} está cambiando, ¡no molestar!`);
}

function checkSheets() {
    updateRequest("awake");

    for (const sheet of spreadsheet.getSheets()) {
        if (excludedSheetIds.includes(sheet.getSheetId()))
            continue;

        /*>---------- [ Set Variables ] ----------<*/
        const nameSheet = sheet.getName();
        const rowSize = sheet.getMaxRows();

        const sheetState = parseInt(scriptProps.getProperty(`${nameSheet}_state`)) || -1;
        const innerData = sheet.getRange(`B1:W${rowSize - 1}`);
        const [sessionNum, channelID, emptySchedule, ansPlayers] = (() => {
            const [sNum, cID, eSch, ...ansPly] = innerData.offset(0, innerData.getNumColumns() - 1, rowSize - 1, 1).getValues().flat(); //Last Column
            return [sNum, cID, eSch, ansPly.filter((row) =>
                Number(row) > 0).length]
        })();

        /*>---------- [ PRE: Check Empty Schedule ] ----------<*/
        if (sheetState) {
            if (emptySchedule) {
                scriptProps.setProperty(`${nameSheet}_state`, 0);
                innerData.getCell(3, 22).setValue(""); //emptySchedule

                const datesData = innerData.offset(0, 0, 1, innerData.getNumColumns() - 1).getDisplayValues().flat(); //First Row
                const dateStrings = datesData.map((_, i) =>
                    `${capFirstLtr(datesData[i - i % 3])}, ${times[i % 3]}`);
                docProps.setProperty(`${nameSheet}_dates`, JSON.stringify(dateStrings));

                innerData.getCell(1, 22).setValue((parseInt(sessionNum) || 0) + 1); //sessionNum
                updateRequest("emptySchedule", { channelID });
                continue;
            }

            /*>---------- [ INTER: Check Session Ready ] ----------<*/
            const numPlayers = rowSize - 5; //rowSize, -3 topMargin, -2 bottomMargin
            if (sheetState !== 1 ||
                ansPlayers < numPlayers - Math.ceil(Math.max(numPlayers - 4, 0) / 2))
                continue;
            Logger.log(`Hoja ${nameSheet} tocada, ¡Horacio valida lío de datos ahora!`);
            scriptProps.setProperty(`${nameSheet}_state`, 0);

            const dateStrings = JSON.parse(docProps.getProperty(`${nameSheet}_dates`));
            const masterDisp = innerData.offset(2, 0, 1, innerData.getNumColumns() - 1).getValues().flat(); //DM Row
            const playerDisp = innerData.offset(rowSize - 1, 0, 1, innerData.getNumColumns() - 1).getValues().flat(); //Total Players Row
            let maxDisp = 0;
            let availDates = [0];
            let closestDate = 0;
            for (let i = 0; i < masterDisp.length; i++) {
                if (!masterDisp[i])
                    continue;

                if (playerDisp[i] > maxDisp) {
                    closestDate = msDateCalc(dateStrings[i]);
                    if (closestDate < minNotice + Date.now())
                        continue;

                    maxDisp = playerDisp[i];
                    availDates = [dateStrings[i]];
                }
                else if (playerDisp[i] === maxDisp)
                    availDates.push(dateStrings[i]);
            }

            const sessionData = {
                channelID,
                sessionNum,
                availDates,
                closestDate
            };

            if (ansPlayers >= numPlayers) {
                availDates ?
                    notifySession(nameSheet, "notifySession", sessionData) :
                    notifySession(nameSheet, "unableSession", { channelID });
                continue;
            }
            scriptProps.setProperty(`${nameSheet}_sessionData`, sessionData);
        }

        /*>---------- [ POST: Check Message Sending ] ----------<*/
        const sessionData = scriptProps.getProperty(`${nameSheet}_sessionData`);
        if (sessionData && sessionData.closestDate < minNotice + Date.now()) {
            sessionData.availDates ?
                notifySession(nameSheet, "notifySession", sessionData) :
                notifySession(nameSheet, "unableSession", { channelID });
            continue;
        }
    }
}

function notifySession(nameSheet, dataType, data) {
    Logger.log("Las fechas están listas, pero el caos podría cambiarlo todo.")
    switch (dataType) {
        case "unableSession":
            Logger.log(`Silencio total en ${nameSheet}... ¿jugadores dormidos o rebeldes?`);
            break;
        case "notifySession":
            Logger.log(`¡Hoja ${nameSheet} tiene día donde todos juntitos! ¡Milagro!`);
            break;
    }

    scriptProps.setProperty(`${nameSheet}_state`, -1);
    scriptProps.deleteProperty(`${nameSheet}_sessionData`);
    updateRequest(dataType, data);
}
function msDateCalc(dateString) {
    const year = new Date().getFullYear();
    const [, day, month, startHour, startMinute] = dateString
        .match(/(\d+)\/(\d+), (\d+):?(\d*)h-(\d+):?(\d*)h/)
        .map(Number);

    return new Date(year, month - 1, day, startHour, startMinute || 0).getTime();
}
function capFirstLtr(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/*>--------------- { Data Transfer } ---------------<*/
async function updateRequest(command, data = {}) {
    const options = {
        "method": "post",
        "muteHttpExceptions": true,
        "contentType": "application/json",
        "payload": JSON.stringify(data)
    };
    try {
        Logger.log(UrlFetchApp.fetch(url + command, options).getContentText());
    }
    catch (error) {
        Logger.log(`Maldicion! Lo vi, pero la cabeza de goblin dice ‘no puedo’. ${error.message}`);
    }
}
function doPost(e) {
    try {
        if (!e.postData || !e.postData.contents)
            throw new Error("Horacio no recibió postData. ¿Headers correctos?");

        const data = JSON.parse(e.postData.contents);
        if (!data.postType)
            throw new Error("No se especificó el tipo de post.");

        switch (data.postType) {
            case "setSchedule":
                Logger.log("Horario en proceso, ¡que nadie interrumpa el hechizo!");
                const newSheet = spreadsheet.getSheetByName("template").copyTo(spreadsheet);
                newSheet.setName(data.sheetName || "role");
                newSheet.setTabColor(data.tabColor);
                newSheet.getRange(`W2`).setValue(data.channelID || "");
                newSheet.showSheet();

                return ContentService.createTextOutput(JSON.stringify({
                    success: true,
                    sheetId: newSheet.getSheetId()
                })).setMimeType(ContentService.MimeType.JSON);

            case "storeTimelapse":
                Logger.log("Recordatorio guardado, ¡goblin tiene memoria de elefante!");
                let storeIndex = 1 + timelapseSheet.getRange("A:A").getValues().findIndex((row) =>
                    row[0] === data.channelID); //getRange("A:B"); row[1] === data.type
                if (storeIndex <= 0) {
                    timelapseSheet.insertRowsAfter(timelapseSheet.getLastRow(), 1);
                    storeIndex = timelapseSheet.getLastRow();
                }

                const rowData = timelapseSheet.getRange(storeIndex, 1, 1, 5);
                const storeData = rowData.getValues()[0];
                rowData.setValues([[
                    data.channelID,
                    data.type ?? storeData[1],
                    data.timeStart ?? storeData[2],
                    data.duration ?? storeData[3],
                    data.actionData
                        ? JSON.stringify(data.actionData)
                        : storeData[4]
                ]]);
                return ContentService.createTextOutput(JSON.stringify({ success: true }))
                    .setMimeType(ContentService.MimeType.JSON);

            case "retrieveTimelapse":
                Logger.log("¡Aaaah! Recordatorio recuperado, ¡espero que todos estén preparados!");
                const retrieveValues = timelapseSheet.getRange("A:E").getValues();
                const matchingRows = retrieveValues.filter((row) =>
                    row[0] === data.channelID);

                const objReturn = { success: true };
                if (matchingRows.length > 0) {
                    objReturn.dataTimelapse = matchingRows.map(([channelID, type, timeStart, duration, actionData]) =>
                        ({ type, timeStart, duration, actionData: JSON.parse(actionData || "{}") }));
                }
                return ContentService.createTextOutput(JSON.stringify(objReturn))
                    .setMimeType(ContentService.MimeType.JSON);
        }
    }
    catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: error.message
        })).setMimeType(ContentService.MimeType.JSON);
    }
}