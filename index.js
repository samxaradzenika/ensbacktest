require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const {google} = require("googleapis");
const keys = require("./keys.json"); // your service account keys
const {body, validationResult} = require("express-validator"); // Import validation methods
const axios = require("axios");
const app = express();
app.use(bodyParser.json());
app.use(cors());

// create Google Auth client
const client = new google.auth.JWT(keys.client_email, null, keys.private_key, [
  "https://www.googleapis.com/auth/spreadsheets",
]);

client.authorize(function (err, tokens) {
  if (err) {
    console.log(err);
    return;
  } else {
    console.log("Connected!");
  }
});

app.post(
  "/submit",
  body("companyEmail").isEmail(), // Validate email
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({errors: errors.array()});
    }

    const {businessName, country, phoneNumber, companyEmail} = req.body;

    // Call Email Verification API
    try {
      const emailApiUrl = "https://emailverification.whoisxmlapi.com/api/v1";
      const emailApiResponse = await axios.get(emailApiUrl, {
        params: {
          apiKey: process.env.WHOISXML_API_KEY,
          emailAddress: companyEmail,
        },
      });

      // If email is not valid, return error
      if (
        emailApiResponse.data.formatCheck === "false" ||
        emailApiResponse.data.dnsCheck === "false" ||
        emailApiResponse.data.smtpCheck === "false"
      ) {
        return res.status(400).json({errors: ["Email is not valid"]});
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({errors: ["Error checking email validity"]});
    }

    // If email is valid, continue with Google Sheets
    const sheets = google.sheets({version: "v4", auth: client});

    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: "1NxAWXGByOE3mL7hkrc9-Qng0PJ7mmhLuOVN52ay4KP4",
        range: "Sheet1",
        valueInputOption: "RAW",
        resource: {
          values: [[businessName, country, phoneNumber, companyEmail]],
        },
      });

      res.json({success: true, message: "Data submitted successfully"});
    } catch (err) {
      console.error(err);
      return res.status(500).json({errors: ["An error occurred"]});
    }
  }
);

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
