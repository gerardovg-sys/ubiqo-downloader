// Opens the HTML form stored in the Target Library
function showProcessAForm() {
  const html = VerificacionLib.getProcessAHtml();
  SpreadsheetApp.getUi().showModalDialog(html, 'Process A: Quote Analysis');
}

// Bridge function: The HTML asks the Source sheet for projects, 
// and the Source sheet asks the Library.
function getTargetProjectNames() {
  return VerificacionLib.fetchProjectNames();
}

// Bridge function: Passes form data AND overwrite flag to the Library
function processQuoteData(formData, forceOverwrite) {
  return VerificacionLib.processQuoteData(formData, forceOverwrite);
}