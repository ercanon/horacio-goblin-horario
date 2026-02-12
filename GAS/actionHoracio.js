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
                const templateSheet = spreadsheet.getSheetByName("template");
                const newSheet = templateSheet.copyTo(spreadsheet);
                newSheet.setName(data.sheetName || "role");
                newSheet.setTabColor(data.tabColor);
                newSheet.getRange(`W2`).setValue(data.channelID || "");
                newSheet.showSheet();

                for (const prot of templateSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE)) {
                    const range = prot.getRange();
                    const newRange = newSheet.getRange(range.getA1Notation());

                    const copyProt = newRange.protect()
                        .setDescription(prot.getDescription());

                    //copyProt.setDomainEdit(false);

                    const editors = prot.getEditors();
                    if (editors.length > 0)
                        copyProt.addEditors(editors);
                }

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