// Quelques listes
const MODES_CONTACT = [
    "Courriel",
    "Tchap",
    "Téléphone",
    "Réunion",
    "Autre",
    "Direct",
]

const MODES_REUNION = [
    "Visio",
    "Présentiel",
    "Téléphone",
    "Autre",
]

const TYPES_TRAVAIL = [
    "préparation",
    "finalisation",
    "création document",
    "création fiche",
    "création visuel",
    "création audio",
    "création film",
    "création outil",
    "création communauté",
    "autre",
    "point Lab",
    "mise en ligne",
]

const AXES = [
    "Agents et équipes",
    "Métiers",
    "Transformation",
    "Autre",
]

const ORIENTATIONS = [
    "Facilitation",
    "Médiation",
    "Co-développement",
    "OpenLab",
    "Réalisation d'un document",
    "Réalisation d'un visuel",
    "Réalisation d'un film ou audio",
    "Pass'Innov",
    "Initiation intelligence collective",
    "Présentation",
    "Autre",
    "Journée Lab",
    "Mutualisation",
]

const SUITES = [
    "Action",
    "Orientation",
    "Aucune",
    "Exploration",
]

const AVEC_QUESTIONNAIRE_OPTIONS = [
    "Non",
    "Unique",
    "Sur la durée",
]

/**
 * Permet d'exécuter fn quand le document est prêt
 */
function ready(fn) {
  if (document.readyState !== 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}


/**
 * normalise une chaîne de caractères
 */
function normalize(s) {
    return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Convertit une date Grist en date JS
 */
function toDate(tsOrList) {
    if (tsOrList === null) {
        return null;
    } else if (typeof tsOrList == "number") {
        return new Date(tsOrList * 1000);
    } else {
        return new Date(tsOrList[1] * 1000);
    }
}

/**
 * Convertit une date Grist en chaîne de caractères
 */
function toDateString(tsOrList) {
    return toDate(tsOrList)?.toLocaleDateString()
}

/**
 * Convertit une date Grist en chaîne de caractères ISO
 */
function toISODateString(tsOrList) {
    return (toDate(tsOrList)?.toISOString())?.slice(0, 10)
}

/**
 * Convertit un objet Grist RowRecords contenant des enregistrements en
 * un tableau d'objets JS.
 */
function toRecords(recordsObject) {
    records = [];
    for (let i=0; i<recordsObject.id.length; i++) {
        const record = Object.fromEntries(
            Object.keys(recordsObject).map(
                (k) => [k, recordsObject[k][i]])
            );
        records.push(record);
    }
    return records
}

/**
 * Convertit un RowRecords Grist en
 * dictionnaire id => objets JS
 */
function toRecordById(recordsObject) {
    return new Map(
        toRecords(recordsObject).map((record) => [record.id, record]));
}

/**
 * Convertit un ensemble d'objets JS en objet Grist RowRecords.
 */
function toRecordObject(records) {
    let ret = {}
    const record = records.shift();
    for (const [k, v] of Object.entries(record)) {
        ret[k] = [v]
    }
    for (const record of records) {
        for (const [k, v] of Object.entries(record)) {
            ret[k].push(v);
        }
    }
    return ret
}

/**
 * Helper pour les actions
 */
class ActionsHelper {
    constructor() {
        this.recordById = null;
    }

    invalidateRecords() {
        this.recordById = null;
    }

    async getRecordById() {
        if (this.recordById === null) {
            const recordsObject = await grist.docApi.fetchTable("Actions");
            this.recordById = toRecordById(recordsObject);
        }
        return this.recordById;
    }

    async getAction(actionId) {
        const recordById = await this.getRecordById();
        return recordById.get(actionId);
    }

    async createAction(data) {
        const actions = grist.getTable("Actions");
        const record = await actions.create({"fields": data});
        this.invalidateRecords();
        return await this.getAction(record.id);
    }

    async updateAction(data, actionId) {
        const sollicitations = grist.getTable("Actions");
        await sollicitations.update({id: actionId, fields: data} );
        this.invalidateRecords();
        return await this.getAction(actionId);
    }

    async removeAction(actionId) {
        const table = await grist.getTable("Actions");
        await table.destroy(actionId);
        this.invalidateRecords();
    }

    async getActions(type, sollicitationId) {
        const recordById = await this.getRecordById();
        const reunionById = new Map(
            [...recordById].filter(([, record]) => {
                return record.Type_Infere === type
                && record.Sollicitation_source === sollicitationId
            })
        );
        return Array.from(reunionById.values());
    }

    async refreshActions(datas) {
        const actionsTable = grist.getTable("Actions");
        await actionsTable.update(datas);
        this.invalidateRecords();
    }

    async getReunions(sollicitationId) {
        return this.getActions("R", sollicitationId)
    }

    async getTravaux(sollicitationId) {
        return this.getActions("T", sollicitationId)
    }

    async getEvenements(sollicitationId) {
        return this.getActions("E", sollicitationId)
    }
}


/**
 * Helper pour les sollicitatitons
 */
class SollicitationsHelper {
    constructor() {
        this.recordById = null;
    }

    invalidateRecords() {
        this.recordById = null;
    }

    async getRecordById() {
        if (this.recordById === null) {
            const recordsObject = await grist.docApi.fetchTable("Sollicitations");
            console.log(recordsObject);
            this.recordById = toRecordById(recordsObject);
        }
        return this.recordById;
    }

    async getSollicitation(id) {
        const recordById = await this.getRecordById();
        return recordById.get(id);
    }

    async createSollicitation(data) {
        const sollicitations = grist.getTable("Sollicitations");
        const record = await sollicitations.create({fields: data});
        this.invalidateRecords();
        return await this.getSollicitation(record.id);
    }

    async updateSollicitation(data, id) {
        const sollicitations = grist.getTable("Sollicitations");
        await sollicitations.update({id: id, fields: data} );
        this.invalidateRecords();
        return await this.getSollicitation(id);
    }

    async removeSollicitation(sollicitationId) {
        const table = await grist.getTable("Sollicitations");
        await table.destroy(sollicitationId);
        this.invalidateRecords();
    }

    async searchSollicitation(s) {
        const t = s.toLowerCase();
        const recordById = await this.getRecordById()
        return new Map(
            [...recordById].filter(([, record]) => this.recordContains(record, t))
        );
    }

    /**
     * l'enregistrement contient la chaîne t
     */
    recordContains(record, t) {
        return (
            record.Description.toLowerCase().includes(t)
            || record.Identifiant.toLowerCase().includes(t)
            || record.Origine.toLowerCase().includes(t)
            || record.Coordonnees.toLowerCase().includes(t)
        );
    }
}

function handleError(err) {
  console.error('ERROR', err);
}

class FormHelper {
    constructor(form) {
        this.form = form;
        this.funcs = new Map();
    }

    initList(k, parseFunc, strFunc) {
        this.funcs.set(k, {
            parse: (k) => this.getList(k, parseFunc),
            str: (k, arr) => this.setList(k, arr, strFunc)
        });
    }

    initValue(k, parseFunc, strFunc) {
        this.funcs.set(k, {
            parse: (k) => this.getValue(k, parseFunc),
            str: (k, v) => this.setValue(k, v, strFunc)
        });
    }

    initCheck(k) {
        this.funcs.set(k, {
            parse: (k) => this.getCheck(k),
            str: (k, v) => this.setCheck(k, v)
        });
    }

    getInputsNames() {
        return Array.from(this.form.querySelectorAll("*[name]")).map((e) => e.name);
    }

    getList(name, parseFunc) {
        const formData = new FormData(this.form);
        const rawValues = formData.getAll(name);
        let values;
        if (parseFunc === undefined) {
            values = rawValues;
        } else {
            values = rawValues.map(parseFunc);
        }
        values.unshift("L");
        console.log(`Get ${rawValues} -> ${values}`);
        return values
    }

    getValue(name, parseFunc) {
        const formData = new FormData(this.form);
        const rawValue = formData.get(name);
        let value;
        if (parseFunc === undefined) {
            value = rawValue;
        } else {
            value = parseFunc(rawValue);
        }
        console.log(`Get ${rawValue} -> ${value}`);
        return value
    }

    getCheck(name) {
        const formData = new FormData(this.form);
        const value = (formData.get(name) === "on");
        console.log(`Get ${value}`);
        return value
    }

    setList(name, values, strFunc) {
        if (values === null) {
            return;
        }
        let rawValues;
        if (strFunc === undefined) {
            rawValues = values.slice(1); // remove "L"
        } else {
            rawValues = values.slice(1).map(strFunc); // remove "L"
        }
        console.log(`Set ${values} -> ${rawValues}`);
        const options = Array.from(this.form[name].options);
        options.forEach(function (option) {
        	option.selected = rawValues.includes(option.value);
        });
    }

    setValue(name, value, strFunc) {
        if (value === null) {
            return;
        }
        let rawValue;
        if (strFunc === undefined) {
            rawValue = value;
        } else {
            rawValue = strFunc(value);
        }
        console.log(`Set ${value} -> ${rawValue}`);
        this.form[name].value = rawValue
    }

    setCheck(name, value) {
        if (value) {
            this.form[name].checked = true;
        }
        console.log(`Set ${value}`);
        return value
    }

    getRecord() {
        const formData = new FormData(this.form);
        const ret = {};
        for (const name of this.getInputsNames()) {
            console.info(">>> " + name);
            if (this.funcs.has(name)) {
                const f = this.funcs.get(name).parse;
                ret[name] = f(name);
            } else {
                console.log(`Get ${formData.get(name)}`);
                ret[name] = formData.get(name);
            }
        }
        return ret;
    }

    setRecord(record) {
        console.info("setRecord");
        console.info(record);
        this.form.reset();
        for (const name of this.getInputsNames()) {
            if (name in record) {
                console.info(">>> " + name);
                if (this.funcs.has(name)) {
                    const f = this.funcs.get(name).str;
                    f(name, record[name]);
                } else {
                    console.log(`Set ${record[name]}`);
                    this.form[name].value = record[name];
                }
            }
        }
    }

    reset() {
        console.log("Reset");
        this.form.reset();
    }
}

/** Retourne la liste des participants en promesse (id + nom) */
async function loadParticipants() {
    const participantsRecords = await grist.docApi.fetchTable("Participants");
    const participants = toRecords(participantsRecords);
    return participants.map(
        function(p) { return { id: p.id, nom: p.Prenom_Nom}; }
    ).sort((a, b) => normalize(a.nom) > normalize(b.nom));
}

/** Retourne la liste des services en promesse (id + libelle) */
async function loadServices() {
    const servicesRecords = await grist.docApi.fetchTable("Services");
    const services = toRecords(servicesRecords);
    return services.map(
        (s) => { return { id: s.id, libelle: s.Services}; }
    ).sort((a, b) => normalize(a.libelle) > normalize(b.libelle));
}

/** Retourne la liste des impacts en promesse (id + intitule) */
async function loadImpacts() {
    const impactRecords = await grist.docApi.fetchTable("Impact");
    const impacts = toRecords(impactRecords);
    return impacts.map(
        (p) => { return { id: p.id, intitule: p.Intitule, code: p.Code_Type}; }
    ).sort((a, b) => normalize(a.intitule) > normalize(b.intitule));
}
function searchSollicitation(s) {
    data.sollicitationsHelper.searchSollicitation(s).then(
        (recordById) => data.foundSollicitations = Array.from(recordById.values())
    );
}

function chooseSollicitation(sollicitationId) {
    data.searchString = "";
    data.foundSollicitations = [];
    data.sollicitationsHelper.getSollicitation(sollicitationId).then(
        (record) => {
            data.curSollicitation = record
        }
    );
}

function resetCurSollicitation() {
    data.curSollicitation = null;
}

function newSollicitation() {
    data.curSollicitation = {
        id: ""
    };
}

/**
 * Crée ou modifie la sollicitation
 */
function upsertSollicitation(sollicitationData) {
    console.log("upsertSollicitation");

    let id = parseInt(sollicitationData.id);
    delete sollicitationData["id"];
    console.log(sollicitationData);

    if (isNaN(id)) {
        console.log("create");
        data.sollicitationsHelper.createSollicitation(sollicitationData).then(
            (sollicitation) => {
                data.curSollicitation = sollicitation
            }
        );
    } else {
        console.log("update");
        data.sollicitationsHelper.updateSollicitation(sollicitationData, id).then(
            (sollicitation) => {
                data.curSollicitation = sollicitation
            }
        );
    }
}



let app = undefined;
var tomSelectAxes = undefined;
var tomSelectOrientations = undefined;

let data = {
    modes: MODES_CONTACT,
    modesReunions: MODES_REUNION,
    axes: AXES,
    orientations: ORIENTATIONS,
    suites: SUITES,

    services: [],
    participants: [],

    sollicitationsHelper: new SollicitationsHelper(),
    actionsHelper: new ActionsHelper(),

    searchString: "",
    origineString: "",
    coordonneesString: "",
    descriptionString: "",
    foundSollicitations: [],
    similarSollicitations: [],
    curSollicitation: null,
    removeSollicitationHTML: null,
}

/**
 * Récupère et initialise le helper de formulaire
 */
function getSollicitationFormHelper() {
    const sollicitationForm = document.getElementById("create-sollicitation-form");
    const helper = new FormHelper(sollicitationForm);
    helper.initList("Point_d_entree", (n) => parseInt(n, 10), (n) => n.toString());
    helper.initValue("Service_concerne", (n) => parseInt(n, 10), (n) => n.toString());
    helper.initValue("Date", undefined, toISODateString);
    helper.initList("Axe");
    helper.initList("Orientations_possibles");
    return helper;
}

/**
 * Crée ou modifie la sollicitation à partir des données du formulaire
 */
function upsertSollicitationFromForm(event) {
    const helper = getSollicitationFormHelper();
    const sollicitationData = helper.getRecord();
    upsertSollicitation(sollicitationData);
    event.preventDefault();
}

/**
 * Remet le formulaire à zéro
 */
function resetSollicitationForm(event) {
    console.log("Reset form");
    const helper = getSollicitationFormHelper();
    helper.reset();
    event.preventDefault();
}

/**
 * Nettoyage Tom Select
 */
function cleanTomSelect() {
    console.log("cleanTomSelect");
    if (tomSelectAxes) {
        tomSelectAxes.destroy();
    }
    if (tomSelectOrientations) {
        tomSelectOrientations.destroy();
    }
}

/**
 * Init Tom Select
 */
function initTomSelect() {
    console.log("initTomSelect");
    tomSelectAxes = new TomSelect("#axes-select", {
        plugins: ['remove_button'],
        settings: {
            options: data.axes
        }
    });

    tomSelectOrientations = new TomSelect("#orientations-select", {
        plugins: ['remove_button'],
        settings: {
            options: data.orientations
        }
    });
}

function removeSollicitationDialog() {
    console.log("removeSollicitationDialog");
    data.removeSollicitationHTML = `<p>${data.curSollicitation.id}</p>`;
}

function removeSollicitation() {
    console.log("removeSollicitation");
    const id = data.curSollicitation.id;
    data.sollicitationsHelper.removeSollicitation(id).then(
        () => {
            data.curSollicitation = null;
            document.getElementById("sollicitation-modal-close").click();
            data.searchString = "";
            data.foundSollicitations = [];
        }
    );
}

function onSollicitationSet() {
    if (data.curSollicitation === null) {
        // pass
    } else {
        Vue.nextTick().then(() => refreshSollicitation());
    }
}

function refreshSollicitation() {
    cleanTomSelect();
    const helper = getSollicitationFormHelper();
    helper.reset();
    helper.setRecord(data.curSollicitation);
    initTomSelect();
}


async function findSimilarAux() {
    const map1 = await data.sollicitationsHelper.searchSollicitation(data.origineString);
    const map2 = await data.sollicitationsHelper.searchSollicitation(data.coordonneesString);
    const map3 = await data.sollicitationsHelper.searchSollicitation(data.descriptionString);
    const keys = new Set(map1.keys()).intersection(new Set(map2.keys())).intersection(new Set(map3.keys()));
    ret = [...map1].filter(([k,]) => keys.has(k)).map(([, v]) => v);
    return ret;
}

function findSimilar(_s) {
    findSimilarAux().then(
        (ret) => {
            data.similarSollicitations = ret;
        }
    );
}

ready(function () {
    Vue.config.errorHandler = handleError;
    app = new Vue({
        el: '#content',
        data: data,
        methods: {
            upsertSollicitationFromForm: upsertSollicitationFromForm,
            searchSollicitation: searchSollicitation,
            removeSollicitationDialog: removeSollicitationDialog,
            removeSollicitation: removeSollicitation,
        },
        watch: {
            searchString: searchSollicitation,
            curSollicitation: onSollicitationSet,
            origineString: findSimilar,
            coordonneesString: findSimilar,
            descriptionString: findSimilar,
        }
    });

    loadParticipants().then((ps) => {
        data.participants = ps
    });
    loadServices().then((services) => {
        data.services = services
    });
    grist.ready();
})