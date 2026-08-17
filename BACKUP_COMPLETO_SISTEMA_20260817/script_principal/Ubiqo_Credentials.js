function handleUbiqoGet(e) {
  if (!e || e.parameter.token !== "SMARTCORP_UBIQO_SECURE_TOKEN_2026") {
    return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
  }
  
  try {
    var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    var targetSheet = null;
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName().toLowerCase();
      if (name.indexOf("ubiqo") !== -1 || name.indexOf("cred") !== -1 || name.indexOf("config") !== -1) {
        targetSheet = sheets[i];
        break;
      }
    }
    if (!targetSheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: "No credentials sheet found" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var values = targetSheet.getDataRange().getValues();
    var user = "";
    var pass = "";
    for (var i = 0; i < values.length; i++) {
      for (var j = 0; j < values[i].length; j++) {
        var val = String(values[i][j] || '').trim();
        var valLower = val.toLowerCase();
        if (valLower === "usuario" || valLower === "user" || valLower === "username") {
          user = String(values[i][j+1] || '').trim();
        } else if (valLower === "contraseña" || valLower === "password" || valLower === "pass") {
          pass = String(values[i][j+1] || '').trim();
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ user: user, pass: pass })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var token = e.parameter.token;
    if (token !== "SMARTCORP_UBIQO_SECURE_TOKEN_2026") {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Unauthorized" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var postData = JSON.parse(e.postData.contents);
    var filename = postData.filename;
    var base64 = postData.base64;
    
    if (!filename || !base64) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Missing filename or base64 data" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var result = auditGuardarArchivoGPS(filename, base64);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
