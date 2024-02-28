const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
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

async function createEvent(auth, eventData) {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const response = await calendar.events.insert({
      auth,
      calendarId: "primary",
      resource: eventData,
    });
    console.log("Event created:", response.data.htmlLink);
  } catch (err) {
    console.error("There was an error contacting the Calendar service:", err);
  }
}

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  // Send the form for creating the event
  res.sendFile(path.join(__dirname, "form.html"));
});

app.post("/create-event", async (req, res) => {
  const { summary, start_time , end_time } = req.body;

  const startTimeWithOffset = start_time + ":00+09:00";
  const endTimeWithOffset = end_time + ":00+09:00";

  const eventData = {
    summary, // Directly use the summary from the form
    start: {
      dateTime: startTimeWithOffset,
      timeZone: "Asia/Tokyo",
    },
    end: {
      dateTime: endTimeWithOffset,
      timeZone: "Asia/Tokyo",
    },
  };

  try {
    const auth = await authorize();
    await createEvent(auth, eventData);
    res.send("Event created successfully!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating event");
  }
});

app.listen(3000, () => console.log("Server listening on port 3000"));