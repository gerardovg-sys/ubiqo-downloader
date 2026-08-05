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

function downloadFile(fileId, destPath, token) {
  return new Promise((resolve, reject) => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const options = {
      headers: { 'Authorization': `Bearer ${token}` }
    };
    const req = https.get(url, options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      } else {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => reject(new Error(`Download failed ${res.statusCode}: ${body}`)));
      }
    });
    req.on('error', err => reject(err));
  });
}

async function main() {
  try {
    const creds = getCredentials();
    const token = await refreshAccessToken(creds);
    const fileId = '1a6lltfH0OxaL4mOnsB_xJS996EDMB53z';
    const destPath = 'c:\\Users\\MARCO\\Desktop\\HOLDING_IA\\BITACORA_SMARTCORP\\scratch\\Reporte_Dinamico_21072026.xlsx';
    console.log("Downloading file...");
    await downloadFile(fileId, destPath, token);
    console.log("File downloaded successfully to:", destPath);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
