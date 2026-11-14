/*
   Copyright 2026 DGFiP / DTNum / Fabrique Numérique

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
// monkey patching FF < 144
if (Map.prototype.getOrInsert === undefined) {
    Map.prototype.getOrInsert = function (key, value) {
        if (this.has(key)) {
            return this.get(key);
        } else {
            this.set(key, value);
            return value;
        }
    }
}

const META_TABLE = "Meta";
const COL_VERSION = "Version";
const COL_TEMPLATE_ID = "TemplateId";

class ConsoleOutput {
    begin(title, info) {
        console.info("> begin output")
        console.info(`tìtle: ${title}`);
        this.next(info);
    }

    next(info) {
        if (info !== undefined) {
            console.info(`* info: ${info}`);
        }
    }

    end() {
        console.info("> end output");
    }
}

class DefaultArchiveCreator {
    constructor(docApi, jszipp, output) {
        /*
         * @param {Object} docApi - the grist doc API
         * @param {Object} jszipp - the JSZip module
         */
        this.docApi = docApi;
        this.jszipp = jszipp;
        this.output = output;
    }

    async create() {
        /*
         * Create the exporter
         *
         * @param {Object} docApi - the grist doc API
         */
        console.info("Creating archive...");
        const writer = new this.jszipp.ZipWriter({outputAs: "blob"});

        this.output.next("Ajout des tables")
        await this.#addTables(writer);
        this.output.next("Ajout des PJ")
        await this.#addAttachments(writer);
        this.output.next("Écriture du zip")
        return await writer.close();
    }

    async #addTables(writer) {
        /*
         * Add tables to zip
         *
         * @param {Object} writer - the zip writer
         */
        const tablesIds = await this.docApi.listTables();
        for (const tableId of tablesIds) {
            await writer.add({
                path: `table/${tableId}.json`,
                data: JSON.stringify(await this.docApi.fetchTable(tableId))
            });
        }
        console.info("Tables %s ajoutées", tablesIds);
    }

    async #addAttachments(writer) {
        /*
         * Add attachments to zip
         *
         * @param {Object} writer - the zip writer
         */
        const colsIdsByTableId = await this.#findColsIdsByTableId();
        const attachmentNameById = await this.#findAttachmentNameById();

        const tokenInfo = await this.docApi.getAccessToken({readOnly: true});

        const addedAttachmentIds = new Set();
        for (let [tableId, colsIds] of colsIdsByTableId) {
            const table = await this.docApi.fetchTable(tableId);
            for (const colId of colsIds) {
                for (let attachmentsIds of table[colId]) {
                    if (attachmentsIds === null) {
                        continue;
                    }

                    for (let attachmentId of attachmentsIds.slice(1)) {
                        if (addedAttachmentIds.has(attachmentId)) {
                            continue;
                        }
                        let attachmentName = attachmentNameById.get(attachmentId);
                        const getURL = `${tokenInfo.baseUrl}/attachments/${attachmentId}/download?auth=${tokenInfo.token}`;
                        let response = await fetch(getURL);
                        if (!response.ok) {
                            console.error(response.statusText);
                            continue;
                        }

                        let blob = await response.blob();
                        let bytes = await blob.bytes();

                        let data = {
                            name: attachmentName,
                            type: blob.type,
                        };
                        let jsonStr = JSON.stringify(data);
                        console.info("Export", attachmentId, jsonStr);

                        await writer.add({
                            path: `attachment/${attachmentId}/meta.json`,
                            data: jsonStr,
                        });

                        await writer.add({
                            path: `attachment/${attachmentId}/${attachmentName}`,
                            data: bytes,
                        });
                        addedAttachmentIds.add(attachmentId);
                    }
                }
            }
        }
    }

    async #findColsIdsByTableId() {
        /*
         * @returns {Map} tableId -> colsId
         */
        const colsIdsByTableId = new Map();
        const gristColumns = await this.docApi.fetchTable("_grist_Tables_column");
        const gristTables = await this.docApi.fetchTable("_grist_Tables");
        gristColumns.parentId.forEach((parentId, index) => {
            if (gristColumns.type[index] === "Attachments") {
                const tableIndex = gristTables.id.findIndex((id) => id === parentId);
                const tableId = gristTables.tableId[tableIndex];
                const colsIds = colsIdsByTableId.getOrInsert(tableId, []);
                colsIds.push(gristColumns.colId[index]);
            }
        });
        return colsIdsByTableId;
    }

    async #findAttachmentNameById() {
        /*
         * @returns {Map} attachmentId -> attachment name
         */
        // TODO : take also timeUpload + new Date(timestamp);
        // The date info might be useful
        const attachmentNameById = new Map();
        const gristAttachments = await this.docApi.fetchTable("_grist_Attachments");
        gristAttachments.id.forEach((id, index) => {
            attachmentNameById.set(id, gristAttachments.fileName[index]);
        });
        return attachmentNameById;
    }
}

class DefaultArchiveExporter {
    constructor(output) {
        this.output = output;
    }

    async exportArchive(zipContent) {
        this.output.next("Export...");
        const suggestedName = this.getArchiveName();
        this.#download(zipContent, suggestedName);
    }

    getArchiveName() {
        let dateStr = new Date().toISOString();
        return `export_${dateStr}.zip`;
    }

    #download(zipContent, suggestedName) {
        /*
         * @param {Object} zipContent - the zip as blob
         * @returns {String} suggestedName -> the zip name
         */
        const url = URL.createObjectURL(zipContent);

        // begin horrible hack
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;

        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        // end horrible hack
    }
}

class Archive {
    constructor(tableById, attachmentDataById) {
        this.tableById = tableById;
        this.attachmentDataById = attachmentDataById;

        this.importOptions = {
            "ignoreMeta": true, // ignore the Meta table from the archive
            "ignoreExtraTables": true, // ignore tables from the archive that are not in the document
            "ignoreMissingCols": true, // ignore cols from the document that are not in the archive
            "ignoreFormulas": true, // // ignore the formula cols from the archive
        }
    }

    get version() {
        return this.meta[COL_VERSION];
    }

    get templateId() {
        return this.meta[COL_TEMPLATE_ID];
    }

    get meta() {
        let meta = this.tableById.get(META_TABLE);
        return Object.fromEntries(
            Object.entries(meta)
                .map(([key, values]) => [key, values[0]])
        );
    }

    get tablesIds() {
        return this.tableById.keys().filter((tableId) => tableId !== META_TABLE);
    }

    tableEntries() {
        return this.tableById.entries().filter((tableId, _table) => tableId !== META_TABLE);
    }

    // begin user funcs
    filterRows(tableId, func) {
        const table = this.tableById.get(tableId);
        const rows = this.#tableToRows(table);
        const newRows = rows.filter((row) => func(row))
        const newTable = this.#rowsToTable(newRows);
        this.tableById.set(tableId, newTable);
    }

    mapRows(tableId, func) {
        const table = this.tableById.get(tableId);
        const rows = this.#tableToRows(table);
        const newRows = rows.map((row) => func(row))
        const newTable = this.#rowsToTable(newRows);
        this.tableById.set(tableId, newTable);
    }

    renameCols(tableId, newNameByOldName) {
        const table = this.tableById.get(tableId);

        const newTable = {};
        const keys = Object.keys(table);
        keys.forEach((key) => {
            let newKey = newNameByOldName.get(key);
            if (newKey === undefined) {
                newKey = key
            }
            newTable[newKey] = table[key];
        })
        this.tableById.set(tableId, newTable);
    }

    removeCols(tableId, colNames) {
        const table = this.tableById.get(tableId);

        const newTable = {};
        const keys = Object.keys(table);
        keys.forEach((key) => {
            if (!colNames.includes(key)) {
                newTable[key] = table[key];
            }
        })
        this.tableById.set(tableId, newTable);
    }

    renameTable(srcTableId, destTableId) {
        const table = this.tableById.get(srcTableId);
        this.tableById.delete(srcTableId);
        this.tableById.set(destTableId, table);
    }

    removeTable(srcTableId) {
        this.tableById.delete(srcTableId);
    }

    duplicateTable(curTableId, newTableId) {
        const table = this.tableById.get(curTableId);
        this.tableById.set(newTableId, structuredClone(table));
    }

    // end user funcs

    #tableToRows(table) {
        let keys = Object.keys(table);
        const rows = Array();
        table.id.forEach((id, index) => {
            const row = Object.fromEntries(keys.map((k) => [k, table[k][index]]))
            rows.push(row);
        })
        return rows;
    }

    #rowsToTable(rows) {
        console.assert(rows.length > 0)
        const table = {}
        const keys = Object.keys(rows[0]);
        keys.forEach((key) => {
            table[key] = [];
        });
        rows.forEach((row) => {
            keys.forEach((key) => {
                table[key].push(row[key]);
            });
        })
        return table
    }
}

class DefaultArchiveReader {
    constructor(jszipp, output) {
        this.jszipp = jszipp;
        this.output = output;
    }

    async readFromEvent(event) {
        this.output.next("Lecture depuis la balise 'input'")
        console.log("Read...");

        const file = this.#getFile(event);
        if (file === null) {
            return;
        }
        this.output.next(`Fichier : ${file.name}`);

        try {
            const zip = await this.jszipp.openZip(file, {
                pathMode: "strict-package",
                maxArchiveSize: 50 * 1024 * 1024,
                maxEntrySize: 10 * 1024 * 1024
            });
            return await this.readZip(zip);
        } catch (error) {
            this.importErr(error);
        }
    }

    #getFile(event) {
        /*
         * @param {Object} event - the event from input
         * @returns the file name
         */
        const input = event.target;
        if (input === null) {
            return null;
        }
        const files = input.files;
        if (files === null || files.length === 0) {
            return null;
        }

        return files[0];
    }

    async readZip(zip) {
        const tableById = new Map();
        const attachmentDataById = new Map();
        for (const entry of zip.entries) {
            const path = entry.path;
            let arr = path.split("/");
            if (arr.length <= 1) {
                console.error("Weird entry", path)
                continue;
            }

            const type = arr[0];
            if (type === "table") {
                const data = await this.#getJSONData(zip, path);
                if (data === null) {
                    continue;
                }
                const tableId = arr[1].replace(/\.[^/.]+$/, "");
                tableById.set(tableId, data);
            } else if (type === "attachment" && arr.length === 3) {
                const attachmentId = parseInt(arr[1]);
                if (isNaN(attachmentId)) {
                    console.error("Wrong attachmentId", path);
                    continue;
                }
                const attachmentData = attachmentDataById.getOrInsert(attachmentId, {});
                if (arr[2] === "meta.json") {
                    const data = await this.#getJSONData(zip, path);
                    if (data === null) {
                        continue;
                    }
                    attachmentData.name = data.name;
                    attachmentData.type = data.type;
                } else {
                    const bytes = await zip.get(path)?.bytes();
                    if (bytes === null) {
                        continue;
                    }
                    attachmentData.bytes = bytes;
                }
            } else {
                console.error("Weird entry", path)
            }
        }

        return new Archive(tableById, attachmentDataById);
    }

    async #getJSONData(zip, path) {
        /*
         * @param {Object} zip - the zip
         * @param {String} path - the path
         */
        const jsonStr = await zip.get(path)?.text();
        if (jsonStr === undefined) {
            console.error("Can't read data");
            return null;
        }
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Bad JSON data", e);
            return null;
        }
    }

    importErr(error) {
        /* Error when reading ZIP file */
        window.alert("Can't read zip file");
        console.error("Can't read zip file", error);
    }
}

class DefaultArchiveImporter {
    static async create(docApi, output) {
        const tokenInfo = await docApi.getAccessToken({readOnly: false});
        return new DefaultArchiveImporter(docApi, tokenInfo, output);
    }

    constructor(docApi, tokenInfo, output) {
        this.docApi = docApi;
        this.tokenInfo = tokenInfo;
        this.output = output;
    }

    async importArchive(archive) {
        /*
         * Basic function that simply import the data.
         */
        this.output.next(`Version de l'archive ${archive.templateId} v.${archive.version}`);
        console.log("Importing...", archive.version);

        this.output.next("Initialisation");
        await this.before(archive);
        this.output.next("Préparation de l'archive");
        await this.prepareArchive(archive);
        await this.#writeArchive(archive);
        this.output.next("Finalisation");
        await this.after(archive);
    }

    async before(archive) {
        // do nothing
    }

    async prepareArchive(archive) {
        // just check id and version...
        const curTemplateId = await this.getCurTemplateId();
        const curVersion = await this.getCurVersion();
        if (archive.templateId !== curTemplateId || archive.version > curVersion) {
            this.output.begin("Erreur", `Impossible d'importer un outil de type ${archive.templateId} v.${archive.version}`);
            throw Error(`Wrong archive ${archive.templateId}`);
        }
        // ...and do nothing
    }

    async after(archive) {
        // do nothing
    }

    async #writeArchive(archive) {
        this.output.next("Écriture des tables (sans les références)");
        const addActions = await this.#buildAddActions(archive);
        const result = await this.docApi.applyUserActions(addActions);
        console.info(`Actions: ${addActions.length} tables added`)

        const newIdsByTableId = this.buildNewIdsByTableId(addActions, result.retValues);

        this.output.next("Écriture des colonnes références");
        const updateActions = await this.#buildUpdateActions(archive, newIdsByTableId);
        await this.docApi.applyUserActions(updateActions);
        console.info(`Actions: ${updateActions.length} tables fixed`)
    }

    async #buildAddActions(archive) {
        const colInfoByColIdByTableId = await this.findColInfoByColIdByTableId();
        const importOptions = archive.importOptions;

        const addActions = Array();

        for (let tableId of archive.tablesIds) {
            this.output.next(`Table : ${tableId}`);
            if (tableId === META_TABLE) {
                if (importOptions.ignoreMeta) {
                    console.warn(`Ignore table Meta from the archive`);
                    continue;
                }
            }
            if (!colInfoByColIdByTableId.has(tableId)) {
                if (importOptions.ignoreExtraTables) {
                    console.warn(`Ignore extra table ${tableId} from the archive`);
                    continue;
                } else {
                    throw Error();
                }
            }
            const colInfoByColId = colInfoByColIdByTableId.get(tableId);
            const table = archive.tableById.get(tableId);

            const records = await this.#buildRecords(archive, colInfoByColId, table);
            const values = Object.values(records)[0];
            const nulls = Array(values.length).fill(null);
            addActions.push(["BulkAddRecord", tableId, nulls, records]);
        }
        console.log(addActions);
        return addActions;
    }

    async #buildUpdateActions(archive, newIdsByTableId) {
        const colInfoByColIdByTableId = await this.findColInfoByColIdByTableId();
        const newIdByOldIdByTableId = this.buildNewIdByOldIdByTableId(archive, newIdsByTableId);
        console.info(newIdByOldIdByTableId);

        const updateActions = Array();
        const refListRegexp = new RegExp("^RefList:(.*)$");
        const refRegexp = new RegExp("^Ref:(.*)$");
        for (let [tableId, table] of archive.tableEntries()) {
            let colInfoByColId = colInfoByColIdByTableId.get(tableId);
            const records = {};
            for (let [colId, colInfo] of colInfoByColId.entries()) {
                const refListM = colInfo.colType.match(refListRegexp);
                if (refListM !== null) {
                    const refTableId = refListM[1];
                    console.log("RefList", tableId, colId, "->", refTableId);
                    const newIdByOldId = newIdByOldIdByTableId.get(refTableId)
                    const newValues = [];
                    for (let arr of table[colId]) {
                        let newArr;
                        if (arr === null) {
                            newArr = null;
                        } else {
                            console.assert(arr[0] === "L")
                            newArr = ["L"]
                            arr.slice(1).forEach((oldId) => {
                                newArr.push(newIdByOldId.get(oldId))
                            });
                        }
                        newValues.push(newArr);
                    }
                    records[colId] = newValues
                } else {
                    const refM = colInfo.colType.match(refRegexp);
                    if (refM !== null) {
                        const refTableId = refM[1];
                        console.log("Ref", tableId, colId, "->", refTableId);
                        const newIdByOldId = newIdByOldIdByTableId.get(refTableId)
                        let newIds = [];
                        for (let oldId of table[colId]) {
                            let newId;
                            if (oldId === null) {
                                newId = null;
                            } else {
                                newId = newIdByOldId.get(oldId);
                            }
                            newIds.push(newId);
                        }
                        records[colId] = newIds
                    }
                }
            }
            if (Object.keys(records).length > 0) {
                updateActions.push(["BulkUpdateRecord", tableId, newIdsByTableId.get(tableId), records]) // for each col
            }
        }
        console.log(updateActions)
        return updateActions;
    }

    buildNewIdByOldIdByTableId(archive, newIdsByTableId) {
        const newIdByOldIdByTableId = new Map();
        for (let [tableId, table] of archive.tableEntries()) {
            const newIds = newIdsByTableId.get(tableId);
            if (newIds === undefined) {
                continue;
            }
            const newIdByOldId = newIdByOldIdByTableId.getOrInsert(tableId, new Map())
            table.id.forEach((id, index) => {
                newIdByOldId.set(id, newIds[index]);
            });
        }
        console.log(newIdByOldIdByTableId);
        return newIdByOldIdByTableId;
    }

    buildNewIdsByTableId(actions, results) {
        const newIdsByTableId = new Map();
        actions.forEach((action, index) => {
            const tableId = action[1];
            const newIds = results[index];
            newIdsByTableId.set(tableId, newIds);
        });
        return newIdsByTableId;
    }

    async #buildRecords(archive, colInfoByColId, table) {
        const attachmentDataById = archive.attachmentDataById;
        const options = archive.importOptions;
        const records = {}
        for (let [colId, colInfo] of colInfoByColId) {
            const values = table[colId];
            if (values === undefined) {
                if (options.ignoreMissingCols) {
                    console.warn(`Ignore missing col ${colId} in the archive`);
                    continue;
                } else {
                    throw new Error();
                }
            }
            if (colInfo.isFormula) {
                if (options.ignoreFormulas) {
                    console.warn(`Ignore formula col ${colId} from the archive`);
                    continue;
                } else {
                    throw new Error();
                }
            }
            if (colInfo.colType.startsWith("Ref:") || colInfo.colType.startsWith("RefList:")) {
                console.info(`First pass: ignoring ref col ${colInfo.colId} (${colInfo.colType})`)
                continue;
            }

            let newValues;
            if (colInfo.colType === "Attachments") {
                newValues = await this.#uploadAttachments(values, attachmentDataById);
            } else {
                newValues = table[colId];
            }
            records[colId] = newValues;
        }
        return records;
    }

    async #uploadAttachments(values, attachmentDataById) {
        const newValues = Array();
        for (let arr of values) {
            let newArr;
            if (arr === null) {
                newArr = null;
            } else {
                console.assert(arr[0] === "L");
                newArr = ["L"];
                for (let attachmentId of arr.slice(1)) {
                    const attachmentData = attachmentDataById.get(attachmentId);
                    const newId = await this.#uploadAttachment(attachmentData);
                    if (newId > 0) {
                        newArr.push(newId);
                    } else {
                        console.error(attachmentData.name);
                    }
                }
            }
            newValues.push(newArr);
        }
        return newValues;
    }

    async #uploadAttachment(data) {
        /*
         * @param {Object} tokenInfo - the grist token info
         * @param {Map} data - the attachment data
         */
        // https://community.getgrist.com/t/upload-attachment-from-custom-widget/13612
        const formData = new FormData();

        const attachmentName = data.name;
        const blob = new Blob([data.bytes], {type: data.type});
        formData.append('upload', blob, attachmentName);
        const postURL = `${this.tokenInfo.baseUrl}/attachments?auth=${this.tokenInfo.token}`;
        const response = await fetch(postURL, {
            method: 'POST',
            body: formData,
            headers: {
                "X-Requested-With": "XMLHttpRequest",
            },
        });
        if (!response.ok) {
            console.error(`Upload échoué: ${response.status} ${response.statusText}`);
            return -1;
        }

        console.log(`Upload ${attachmentName}`)
        const result = await response.json();
        return result[0];
    }

    async findColInfoByColIdByTableId() {
        /*
         * @returns {Map} tableId -> colId -> colType
         */
        const colTypeByColIdByTableId = new Map();
        const gristColumns = await this.docApi.fetchTable("_grist_Tables_column");
        const gristTables = await this.docApi.fetchTable("_grist_Tables");
        gristColumns.parentId.forEach((parentId, index) => {
            const tableIndex = gristTables.id.findIndex((id) => id === parentId);
            const tableId = gristTables.tableId[tableIndex];
            const colTypeByColId = colTypeByColIdByTableId.getOrInsert(tableId, new Map());
            const colId = gristColumns.colId[index];
            const colType = gristColumns.type[index];
            const isFormula = gristColumns.isFormula[index];
            colTypeByColId.set(colId, {
                "colType": colType, "isFormula": isFormula
            });
        });
        return colTypeByColIdByTableId;
    }

    async getCurTemplateId() {
        const metaTable = await this.docApi.fetchTable(META_TABLE);
        return metaTable[COL_TEMPLATE_ID][0];
    }

    async getCurVersion() {
        const metaTable = await this.docApi.fetchTable(META_TABLE);
        return metaTable[COL_VERSION][0];
    }
}

grist.ready({
    requiredAccess: 'full',
});

async function main(_event) {
    const docApi = grist.docApi;
    const jszipp = await import("https://unpkg.com/web-jszipp/dist/jszipp.mjs");

    function createOutput() {
        try {
            // responsibility of user
            return new DocumentOutput(document);
        } catch (ReferenceError) {
            return new ConsoleOutput();
        }
    }

    function createArchiveCreator(docApi, jszipp, output) {
        try {
            // responsibility of user
            return new ArchiveCreator(docApi, jszipp, output);
        } catch (ReferenceError) {
            return new DefaultArchiveCreator(docApi, jszipp, output);
        }
    }

    function createArchiveExporter(output, zipContent) {
        try {
            // responsibility of user
            return new ArchiveExporter(output)
        } catch (ReferenceError) {
            return new DefaultArchiveExporter(output)
        }
    }

    async function exportArchive(_event) {
        const output = createOutput();
        output.begin("Export de l'archive")
        const archiveCreator = createArchiveCreator(docApi, jszipp, output);
        const zipContent = await archiveCreator.create();
        const archiveExporter = createArchiveExporter(output, zipContent);
        await archiveExporter.exportArchive(zipContent);
        output.next("Terminé")
        output.end()
    }

    function createArchiveReader(jszipp, output) {
        try {
            // responsibility of user
            return new ArchiveReader(jszipp, output);
        } catch (ReferenceError) {
            return new DefaultArchiveReader(jszipp, output);
        }
    }

    function createArchiveImporter(docApi, output) {
        try {
            // responsibility of user
            return ArchiveImporter.create(docApi, output);
        } catch (ReferenceError) {
            return DefaultArchiveImporter.create(docApi, output)
        }
    }

    async function importArchive(event) {
        const output = createOutput();
        output.begin("Import de l'archive")
        const reader = createArchiveReader(jszipp, output);
        const archive = await reader.readFromEvent(event);
        const archiveImporter = await createArchiveImporter(docApi, output);
        await archiveImporter.importArchive(archive);
        output.next("Terminé")
        output.end()
    }

    document.getElementById("export").onclick = exportArchive;
    document.getElementById("import").onchange = importArchive;
}

document.addEventListener("DOMContentLoaded", main)
