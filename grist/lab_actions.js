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


class TomSelectHandler {
    constructor() {
        this.tomSelectTravail = undefined;
        this.tomSelectReunion = undefined;
        this.tomSelectEvenement = undefined;
        this.tomSelectSuitesObsInterne = undefined;
        this.tomSelectSuitesIndicateur = undefined;
    }

    cleanTravail() {
        this.clean(this.tomSelectTravail);
    }

    cleanReunion() {
        this.clean(this.tomSelectReunion);
    }

    cleanEvenement() {
        this.clean(this.tomSelectEvenement);
    }

    clean(tomSelect) {
        if (tomSelect) {
            tomSelect.destroy();
        }
    }

    initTravail() {
        const opts = Array.from(data.participants).map((p) => { new Option(p.nom, p.id) })
        this.tomSelectTravail = new TomSelect("#participants-travail-select", {
            plugins: ['remove_button'],
                settings: {
                    options: opts
                }
        });
    }

    initReunion() {
        const opts = Array.from(data.participants).map((p) => { new Option(p.nom, p.id) })
        this.tomSelectReunion = new TomSelect("#participants-reunion-select", {
            plugins: ['remove_button'],
                settings: {
                    options: opts
                }
        });
    }

    initEvenement() {
        const opts = Array.from(data.participants).map((p) => { new Option(p.nom, p.id) })
        this.tomSelectEvenement = new TomSelect("#participants-evenement-select", {
            plugins: ['remove_button'],
                settings: {
                    options: opts
                }
        });
    }

    cleanSuites() {
        if (this.tomSelectSuitesObsInterne) {
            this.tomSelectSuitesObsInterne.destroy();
        }
        if (this.tomSelectSuitesIndicateur) {
            this.tomSelectSuitesIndicateur.destroy();
        }
    }

    initSuites() {
        console.log("Init TomSelect suites");
        const opts = Array.from(data.obsInternes).map((p) => { new Option(p.intitule, p.id) });
        this.tomSelectSuitesObsInterne = new TomSelect("#obs-interne-select", {
            plugins: ['remove_button'],
                settings: {
                    options: opts
                }
        });
        const opts2 = Array.from(data.indicateurs).map((p) => { new Option(p.intitule, p.id) });
        this.tomSelectSuitesObsInterne = new TomSelect("#indicateur-select", {
            plugins: ['remove_button'],
                settings: {
                    options: opts2
                }
        });
    }
}

let tomSelectHandler = new TomSelectHandler();


let data = {
    modes: MODES_CONTACT,
    modesReunions: MODES_REUNION,
    typesTravail: TYPES_TRAVAIL,
    axes: AXES,
    orientations: ORIENTATIONS,
    suites: SUITES,
    avecQuestionnaireOptions: AVEC_QUESTIONNAIRE_OPTIONS,

    sollicitationsHelper: new SollicitationsHelper(),
    actionsHelper: new ActionsHelper(),

    participants: [],
    services: [],
    obsInternes: [],
    indicateurs: [],

    removeActionHTML: null,
    actionPpale: null,
    searchString: "",

    foundSollicitations: [],
    foundReunions: [],
    foundTravaux: [],
    foundEvenements: [],

    curSollicitation: null,
    curAction: null,
    avecQuestionnaire: null,
}

function onSollicitationSet() {
    if (data.curSollicitation === null) {
        // pass
    } else {
        refreshActions(data.curSollicitation.id);
        refreshSuites();
    }
}

/**
 * Met à jour les suites
 */
function refreshSuites() {
    data.avecQuestionnaire = data.curSollicitation.Avec_questionnaire;
    Vue.nextTick().then(
        () => {
            tomSelectHandler.cleanSuites();
            const helper = getSuitesFormHelper();
            helper.setRecord(data.curSollicitation);
            tomSelectHandler.initSuites();
        }
    )
}

/**
 * Met à jour les actions associées à une sollicitation
 */
function refreshActions(sollicitationId) {
    console.log("update actions");
    data.actionsHelper.getReunions(sollicitationId).then(
        (reunions) => data.foundReunions = reunions
    );
    data.actionsHelper.getTravaux(sollicitationId).then(
        (travaux) => data.foundTravaux = travaux
    );
    data.actionsHelper.getEvenements(sollicitationId).then(
        (evenements) => data.foundEvenements = evenements
    );
    console.log("actions updated");
}

/**
 * Ouvre un dialogue de confirmation
 */
function openRemoveActionDialog(id) {
    data.actionsHelper.getAction(id).then(
        (action) => {
            data.curAction = action; // nécessaire pour le récupérer ensuite
            data.removeActionHTML = `<p class="fr-badge">${action.Type}</p><p><strong>${action.Titre}</strong> (${toDateString(action.Date)})</p>`;
        }
    );
}

/**
 * Après confirmation
 */
function removeAction() {
    const id = data.curAction.id;
    data.curAction = null;
    data.actionsHelper.removeAction(id).then(
        () => {
            document.getElementById("action-modal-close").click();
            refreshActions(data.curSollicitation.id);
        }
    );
}

/**
 * Ouvre un dialogue de modification
 */
function openModifyActionDialog(id) {
    data.actionsHelper.getAction(id).then(
        (action) => {
            data.curAction = action;
            Vue.nextTick().then(() => refreshActionForm() );
        }
    );
}

/**
 * Met l'action id comme action principale
 */
function setActionPrincipale(id) {
    toUpdate = [];
    const actions = [...data.foundReunions, ...data.foundTravaux, ...data.foundEvenements];
    for (let action of actions) {
        if (action.Action_principale) {
            if (action.id !== id) {
                action.Action_principale = false;
                toUpdate.push({id: action.id, fields: {Action_principale: false}});
            }
        } else {
            if (action.id === id) {
                action.Action_principale = true;
                toUpdate.push({id: action.id, fields: {Action_principale: true}});
            }
        }
    }
    data.actionsHelper.refreshActions(toUpdate);
}

/**
 * Met à jour la suite
 */
function updateSuite(_event) {
    console.log("updateSuite");
    const helper = getSuitesFormHelper();
    const record = helper.getRecord();
    const id = parseInt(record.id);
    delete record["id"];
    console.log(record);

    data.sollicitationsHelper.updateSollicitation(record, id).then(
        (sollicitation) => {
            data.curSollicitation = sollicitation
        }
    )
}

/**
 * Crée une action vide
 */
function newActionDialog(typeInfere) {
    data.curAction = {
        id: "",
        Type_Infere: typeInfere
    }
    Vue.nextTick().then(() => refreshActionForm() );
}


function upsertAction(actionData, modalId) {
    actionData.Sollicitation_source = data.curSollicitation.id;
    const id = parseInt(actionData.id);
    delete actionData["id"];
    console.log(actionData);

    if (data.curAction.id === "") {
        console.error("create");
        delete actionData.id
        data.actionsHelper.createAction(actionData).then(
            () => {
                document.getElementById(modalId).click();
                refreshActions(data.curSollicitation.id);
            }
        )
    } else {
        console.error("update");
        data.actionsHelper.updateAction(actionData, id).then(
            () => {
                document.getElementById(modalId).click();
                refreshActions(data.curSollicitation.id);
            }
        )
    }
}

// TRAVAIL ***********

function getTravailFormHelper() {
    const travailForm = document.getElementById("create-travail-form");
    const helper = new FormHelper(travailForm);
    helper.initValue("Date", undefined, toISODateString);
    helper.initValue("Duree_heures_", parseFloat, (n) => n.toString());
    helper.initList("Participants_Lab", (s) => parseInt(s, 10), (n) => n.toString());
    helper.initCheck("Travail_realise");
    return helper;
}

function upsertTravail(event) {
    try {
        const helper = getTravailFormHelper();
        const actionData = helper.getRecord();
        const modalId = "create-travail-modal-button";
        upsertAction(actionData, modalId);
    } catch (err) {
        handleError(err);
    } finally {
       event.preventDefault();
    }
}
// ***********

// REU ***********
function getReunionFormHelper() {
    const reunionForm = document.getElementById("create-reunion-form");
    const helper = new FormHelper(reunionForm);
    helper.initValue("Date", undefined, toISODateString);
    helper.initValue("Duree_heures_", parseFloat, (n) => n.toString());
    helper.initList("Participants_Lab", (s) => parseInt(s, 10), (n) => n.toString());
    return helper;
}

function upsertReunion(event) {
    try {
        const helper = getReunionFormHelper();
        const actionData = helper.getRecord();
        const modalId = "create-reunion-modal-button";
        upsertAction(actionData, modalId);
    } catch (err) {
        handleError(err);
    } finally {
       event.preventDefault();
    }
}
// *********************

// EVENEMENT ***********
function getEvenementFormHelper() {
    const evenementForm = document.getElementById("create-evenement-form");
    const helper = new FormHelper(evenementForm);
    helper.initValue("Date", undefined, toISODateString);
    helper.initValue("Duree_heures_", parseFloat, (n) => n.toString());
    helper.initList("Participants_Lab", (s) => parseInt(s, 10), (n) => n.toString());
    return helper;
}

function upsertEvenement(event) {
    try {
        const helper = getEvenementFormHelper();
        const actionData = helper.getRecord();
        const modalId = "create-evenement-modal-button";
        upsertAction(actionData, modalId);
    } catch (err) {
        handleError(err);
    } finally {
       event.preventDefault();
    }
}

// *********************

function getSuitesFormHelper() {
    const form = document.getElementById("suite-form");
    const helper = new FormHelper(form);
    helper.initList("Impact_Observatoire_interne", (s) => parseInt(s, 10), (n) => n.toString());
    helper.initList("Impact_Indicateurs_Reperes", (s) => parseInt(s, 10), (n) => n.toString());
    helper.initCheck("Questionnaire_a_chaud_envoye");
    helper.initCheck("Questionnaire_6_mois");
    helper.initCheck("Questionnaire_12_mois");
    helper.initCheck("Questionnaire_24_mois");
    return helper;
}

/**
 * Met l'affichage des données à jour
 */
function refreshActionForm() {
    let helper;
    switch (data.curAction.Type_Infere) {
        case "T":
            tomSelectHandler.cleanTravail();
            helper = getTravailFormHelper();
            helper.setRecord(data.curAction);
            tomSelectHandler.initTravail();
            break;
        case "R":
            tomSelectHandler.cleanReunion();
            helper = getReunionFormHelper();
            helper.setRecord(data.curAction);
            tomSelectHandler.initReunion();
            break;
        case "E":
            tomSelectHandler.cleanEvenement();
            helper = getEvenementFormHelper();
            helper.setRecord(data.curAction);
            tomSelectHandler.initEvenement();
            break;
        default:
            console.log("type inconnu");
            break;
    }
}

/**
 * La sélection "avec questionnaire" -> affichage (ou non)
 */
function setAvecQuestionnaire(event) {
    console.error("setAvecQuestionnaire");
    const avecQuestionnaire = document.getElementById("avec-questionnaire-select");
    console.log(avecQuestionnaire);
    data.avecQuestionnaire = avecQuestionnaire.value;
    event.preventDefault();
}

ready(function() {
    Vue.config.errorHandler = handleError;
    app = new Vue({
        el: '#content',
        data: data,
        methods: {
            upsertTravail: upsertTravail,
            upsertReunion: upsertReunion,
            upsertEvenement: upsertEvenement,
            updatesuite: updateSuite,
            searchSollicitation: searchSollicitation,
            chooseSollicitation: chooseSollicitation,
            setActionPrincipale: setActionPrincipale,
            setAvecQuestionnaire: setAvecQuestionnaire,
            toDateString: toDateString,
            refreshSuites: refreshSuites,
        },
        watch: {
            searchString: searchSollicitation,
            curSollicitation: onSollicitationSet,
        }
    });

    loadParticipants().then((ps) => { data.participants = ps });
    loadServices().then(function(services) { data.services = services });
    loadImpacts().then(function(impacts) {
        data.obsInternes = impacts.filter((i) => i.code === "OI");
        data.indicateurs = impacts.filter((i) => i.code === "I");
    });
    grist.ready();
})