/*>--------------- { Global Variables } ---------------<*/
const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
const scriptProps = PropertiesService.getScriptProperties();
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

        const innerData = sheet.getRange(`B1:W${rowSize - 1}`);
        const [sessionNum, channelID, emptySchedule, ansPlayers] = (() => {
            const lastCol = innerData.offset(0, innerData.getNumColumns() - 1, rowSize - 1, 1).getValues(); //Last Column
            return [lastCol[0][0], lastCol[1][0], lastCol[2][0], lastCol[rowSize - 2][0]]
        })();

        /*>---------- [ PRE: Check Empty Schedule ] ----------<*/
        if (emptySchedule) {
            scriptProps.setProperty(`${nameSheet}_state`, 0);
            innerData.getCell(3, 22).setValue(""); //emptySchedule

            const datesData = innerData.offset(0, 0, 1, innerData.getNumColumns() - 1).getDisplayValues().flat(); //First Row
            const dateStrings = datesData.map((_, i) =>
                `${capFirstLtr(datesData[i - i % 3])}, ${times[i % 3]}`);
            scriptProps.setProperty(`${nameSheet}_dates`, JSON.stringify(dateStrings));

            innerData.getCell(1, 22).setValue((parseInt(sessionNum) || 0) + 1); //sessionNum
            updateRequest("emptySchedule", { channelID });
            continue;
        }

        /*>---------- [ INTER: Check Session Ready ] ----------<*/
        const sheetState = parseInt(scriptProps.getProperty(`${nameSheet}_state`));
        const numPlayers = rowSize - 5; //rowSize, -3 topMargin, -2 bottomMargin
        if (sheetState === 1 &&
            ansPlayers > numPlayers - Math.ceil(Math.max(numPlayers - 4, 0) / 2)) {
            Logger.log(`Hoja ${nameSheet} tocada, ¡Horacio valida lío de datos ahora!`);
            scriptProps.setProperty(`${nameSheet}_state`, 0);

            const dateStrings = JSON.parse(scriptProps.getProperty(`${nameSheet}_dates`));
            const masterDisp = innerData.offset(2, 0, 1, innerData.getNumColumns() - 1).getValues().flat(); //DM Row
            const playerDisp = innerData.offset(rowSize - 2, 0, 1, innerData.getNumColumns() - 1).getValues().flat(); //Total Players Row

            let maxDisp = 0;
            let availDates = [];
            let closestDate = 0;
            masterDisp.forEach((master, i) => {
                if (!master)
                    return;
                const dateStr = dateStrings[i];
                closestDate = msDateCalc(dateStr);
                if (closestDate < minNotice + Date.now())
                    return;

                const disp = playerDisp[i];
                if (disp > maxDisp) {
                    maxDisp = disp;
                    availDates = [dateStr];
                }
                else if (disp === maxDisp)
                    availDates.push(dateStr);
            });

            const sessionData = {
                channelID,
                sessionNum,
                availDates,
                closestDate
            };

            if (ansPlayers >= numPlayers) {
                !availDates.length ?
                    notifySession(nameSheet, "unableSession", { channelID }) :
                    notifySession(nameSheet, "notifySession", sessionData);
                continue;
            }

            scriptProps.setProperty(`${nameSheet}_sessionData`, sessionData);
            continue;
        }

        /*>---------- [ POST: Check Message Sending ] ----------<*/
        const sessionData = scriptProps.getProperty(`${nameSheet}_sessionData`);
        if (sessionData?.closestDate < minNotice + Date.now())
            notifySession(nameSheet, "notifySession", sessionData)
    }
}

function notifySession(nameSheet, notiType, data) {
    Logger.log("Las fechas están listas, pero el caos podría cambiarlo todo.")
    switch (notiType) {
        case "unableSession":
            Logger.log(`Silencio total en ${nameSheet}... ¿jugadores dormidos o rebeldes?`);
            break;
        case "notifySession":
            Logger.log(`¡Hoja ${nameSheet} tiene día donde todos juntitos! ¡Milagro!`);
            break;
    }

    for (const dataType of [`state`, `dates`, `sessionData`])
        scriptProps.deleteProperty(`${nameSheet}_${dataType}`);
    updateRequest(notiType, data);
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