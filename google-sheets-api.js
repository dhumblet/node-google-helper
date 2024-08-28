const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
let TOKEN_PATH
let CREDENTIALS_PATH

module.exports = {init, authorize, addSheet, clearRange, getLastRow, addRow, readRange, editRange}

function init (tokenPath, credentialsPath) {
    TOKEN_PATH = path.join(process.cwd(), tokenPath);
    CREDENTIALS_PATH = path.join(process.cwd(), credentialsPath);
}

async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

async function addSheet(auth, id, name) {
    const sheets = google.sheets({ version: 'v4', auth })
    const request = {
        "spreadsheetId": id,
        "resource": {
            "requests": [{
                "addSheet": {
                    "properties": {
                        "title": name,
                        "index": 0,
                    }
                }
            }]
        }
    }

    await sheets.spreadsheets.batchUpdate(request, (err) => {
        if (err) {
            console.error(err)
        }
    })
}

async function clearRange(auth, id, range) {
    const sheets = google.sheets({version: 'v4', auth})
    await sheets.spreadsheets.values.clear({
        spreadsheetId: id,
        range: range,
    })
}

async function getLastRow(auth, id, sheetName) {
    const sheets = google.sheets({version: 'v4', auth})
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: sheetName,
    })

    if (response.data.values === undefined) {
        return 0
    } else {
        return response.data.values.length
    }
}

async function readRange(auth, id, range) {
    const sheets = google.sheets({version: 'v4', auth})
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: id,
        range: range,
    })

    if (response.data.values === undefined) {
        return 0
    } else {
        return response.data.values
    }
}

async function addRow(auth, id, range, data) {
    const sheets = google.sheets({ version: 'v4', auth })

    const request = {
        spreadsheetId: id,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: data
        }
    }

    await sheets.spreadsheets.values.append(request, (err) => {if (err) console.error(err)})
}

async function editRange(auth, id, range, data){
    const sheets = google.sheets({ version: 'v4', auth })

    const request = {
        spreadsheetId: id,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: data
        }
    }

    await sheets.spreadsheets.values.update(request, (err) => {if (err) console.error(err)})
}
