// Opens the HTML form stored in the Target Library
function showProcessAForm() {
  if (typeof VerificacionLib === 'undefined') {
    SpreadsheetApp.getUi().alert('⚠️ La librería VerificacionLib no está vinculada o no se tienen permisos de acceso.');
    return;
  }
  const html = VerificacionLib.getProcessAHtml();
  SpreadsheetApp.getUi().showModalDialog(html, 'Process A: Quote Analysis');
}

// Bridge function: The HTML asks the Source sheet for projects, 
// and the Source sheet asks the Library.
function getTargetProjectNames() {
  if (typeof VerificacionLib === 'undefined') return [];
  return VerificacionLib.fetchProjectNames();
}

// Bridge function: Passes form data AND overwrite flag to the Library
function processQuoteData(formData, forceOverwrite) {
  if (typeof VerificacionLib === 'undefined') return { success: false, message: 'Librería VerificacionLib no disponible' };
  return VerificacionLib.processQuoteData(formData, forceOverwrite);
}