const fs = require('fs');
const https = require('https');
const querystring = require('querystring');

const clasprcPath = 'C:\\Users\\MARCO\\.clasprc.json';
const fileId = '1RU4tfV0Nn_w1YeUasq-iOwLo3Ms54tO3';
const outputPath = 'c:\\Users\\MARCO\\Desktop\\HOLDING_IA\\BITACORA_SMARTCORP\\scratch\\sample.xlsx';

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

function downloadFile(fileId, token) {
  return new Promise((resolve, reject) => {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const options = {
      headers: { 'Authorization': `Bearer ${token}` }
    };

    const fileStream = fs.createWriteStream(outputPath);
    
    console.log(`Downloading file ${fileId} from Drive...`);
    const req = https.get(url, options, (res) => {
      if (res.statusCode === 200) {
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`File downloaded successfully to ${outputPath}`);
          resolve();
        });
      } else {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          reject(new Error(`Failed to download: Status ${res.statusCode}, Body: ${body}`));
        });
      }
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

    await downloadFile(fileId, token);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
