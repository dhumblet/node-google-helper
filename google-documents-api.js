const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/documents'];
let TOKEN_PATH
let CREDENTIALS_PATH

module.exports = {init, authorize, readDoc, writeToDoc, clearDoc}

function init (tokenPath, credentialsPath) {
    TOKEN_PATH = path.join(process.cwd(), tokenPath)
    CREDENTIALS_PATH = path.join(process.cwd(), credentialsPath)
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

async function readDoc(auth, id) {
    const docs = google.docs({
        version: "v1",
        auth
    });

    const document = await docs.documents.get({
        documentId: id
    });

    console.log(document.data.body.content)
    const jsonData = JSON.stringify(document.data.body)
    const filePath = 'documentTemplate.json'

    try {
        await fs.writeFile(filePath, jsonData);
        console.log('JSON data saved to file successfully.');
    } catch (error) {
        console.error('Error writing JSON data to file:', error);
    }
}

async function writeToDoc(auth, id, requests) {
    const docs = google.docs({
        version: "v1",
        auth
    })

    console.log(JSON.stringify(requests))

    try {
        const res = await docs.documents.batchUpdate({
            documentId: id,
            requestBody: {
                requests: requests
            },
        });

        console.log('Document updated successfully:', res.data);
    } catch (err) {
        console.error('Error updating document:', err);
    }
}

async function clearDoc(auth, id) {
    const docs = google.docs({
        version: "v1",
        auth
    });
    let document = await docs.documents.get({documentId: id})
    let endIndex = document.data.body.content[document.data.body.content.length - 1].endIndex;

    let requests = [
        {
            deleteContentRange: {
                range: {
                    startIndex: 1,
                    endIndex: endIndex - 1,
                },
            },
        },
    ]

    try {
        await docs.documents.batchUpdate({
            documentId: id,
            requestBody: {
                requests: requests
            }
        })
    } catch (err) {
        console.error('Error clearing document')
    }
}
