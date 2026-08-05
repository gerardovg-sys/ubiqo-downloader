const fs = require('fs');
const https = require('https');
const querystring = require('querystring');

const clasprcPath = 'C:\\Users\\MARCO\\.clasprc.json';

function getCredentials() {
  return JSON.parse(fs.readFileSync(clasprcPath, 'utf8'));
}

async function refreshAccessToken(creds) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      client_id: creds.tokens.default.client_id,
      client_secret: creds.tokens.default.client_secret,
      refresh_token: creds.tokens.default.refresh_token,
      grant_type: 'refresh_token'
    });

    const options = {
      hostname: 'oauth2.googleapis.com',
      port: 443,
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const newCreds = JSON.parse(body);
          resolve(newCreds.access_token);
        } else {
          reject(new Error(`Failed to refresh token: Status ${res.statusCode}, Body: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Status: ${res.statusCode}, Body: ${body}`));
        }
      });
    });
    req.on('error', (err) => reject(err));
  });
}

async function main() {
  try {
    const creds = getCredentials();
    let token = creds.tokens.default.access_token;
    
    try {
      token = await refreshAccessToken(creds);
      creds.tokens.default.access_token = token;
      fs.writeFileSync(clasprcPath, JSON.stringify(creds, null, 2));
    } catch (e) {
      console.warn("Could not refresh token:", e.message);
    }

    const headers = { 'Authorization': `Bearer ${token}` };

    const folderId = '1RiGoDqORutSwb5svJmBZaR0KGCACdWRr';
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed%3Dfalse&fields=files(id,name,mimeType,size,createdTime)&orderBy=createdTime+desc`;
    
    console.log("Checking files in GPS_Pendientes...");
    const filesData = await makeRequest(driveUrl, headers);
    console.log("Files found in GPS_Pendientes:", JSON.stringify(filesData.files, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

main();
