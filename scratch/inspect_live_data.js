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

    // 1. Check Pendientes folder
    const folderPendientesId = '1TALOZQf1D07iICjXmi9pupEgGg5fl5xm';
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${folderPendientesId}'+in+parents+and+trashed%3Dfalse&fields=files(id,name,mimeType,size,createdTime)&orderBy=createdTime+desc`;
    
    console.log("=== CHECKING FILES IN GPS_Pendientes FOLDER ===");
    const filesData = await makeRequest(driveUrl, headers);
    console.log("Files found in GPS_Pendientes:", JSON.stringify(filesData.files, null, 2));

    // 2. Check Procesados folder
    const folderProcesadosId = '1RiGoDqORutSwb5svJmBZaR0KGCACdWRr';
    const procUrl = `https://www.googleapis.com/drive/v3/files?q='${folderProcesadosId}'+in+parents+and+trashed%3Dfalse&fields=files(id,name,mimeType,size,createdTime)&orderBy=createdTime+desc`;
    console.log("\n=== CHECKING FILES IN GPS_Procesados FOLDER ===");
    const procFilesData = await makeRequest(procUrl, headers);
    console.log("Recent files in GPS_Procesados:", JSON.stringify(procFilesData.files ? procFilesData.files.slice(0, 5) : [], null, 2));

    // 3. Read Bitacora_Prueba rows
    const bitacoraSheetId = '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY';
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${bitacoraSheetId}/values/Bitacora_Prueba!A1:Z50`;
    console.log("\n=== READING Bitacora_Prueba SHEET ROWS ===");
    const sheetsData = await makeRequest(sheetsUrl, headers);
    console.log("Bitacora_Prueba values (first 25 rows):", JSON.stringify(sheetsData.values, null, 2));

    // 4. Read User's Ubiqo Sheet ID (1a6lltfH0OxaL4mOnsB_xJS996EDMB53z)
    const ubiqoSheetId = '1a6lltfH0OxaL4mOnsB_xJS996EDMB53z';
    const ubiqoUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ubiqoSheetId}?fields=sheets.properties`;
    console.log("\n=== READING USER UBIQO SHEET (1a6lltfH0OxaL4mOnsB_xJS996EDMB53z) ===");
    try {
      const ubiqoMeta = await makeRequest(ubiqoUrl, headers);
      console.log("Ubiqo sheet metadata:", JSON.stringify(ubiqoMeta, null, 2));
    } catch (e) {
      console.log("Could not read user Ubiqo sheet:", e.message);
    }

  } catch (err) {
    console.error("Error in main:", err);
  }
}

main();
