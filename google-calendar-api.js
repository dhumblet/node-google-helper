const fs = require('fs').promises;
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');
const path = require('path');
const {DateTime} = require("luxon");


const SCOPES = ['https://www.googleapis.com/auth/calendar'];
let TOKEN_PATH
let CREDENTIALS_PATH

module.exports = {init, authorize, scheduleMeeting}

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

async function scheduleMeeting(auth, datetime, durationInMinutes, attendees, summary, description, colorId, attachment) {
    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
        summary: summary,
        description: description,
        start: {
            dateTime: datetime,
        },
        end: {
            dateTime: addMinutesToDateTime(datetime, durationInMinutes)
        },
        attendees: attendees.map(email => ({ email })),
        colorId: colorId,
        guestsCanModify: true,
        attachments: [
            {
                fileUrl: attachment,
                title: summary,
                mimeType: 'application/vnd.google-apps.document',
            },
        ],
    };

    try {
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event,
            sendUpdates: 'all',
            supportsAttachments: true
        });

        console.log('Event created: %s', response.data.htmlLink);
    } catch (error) {
        console.error('Error creating event:', error);
    }
}

function addMinutesToDateTime(input, minutes) {
    let dateTime = DateTime.fromISO(input)
    const result = dateTime.plus({ minutes: minutes });
    return result.toISO()
}
