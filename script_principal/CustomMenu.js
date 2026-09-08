function onOpen() {
  var ui = null;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    return;
  }
  if (!ui) return;
  
  // 1. TU MENÚ EXISTENTE (Agenda)
  try {
    ui.createMenu('🚀 Agenda')
        .addItem('Generar agenda', 'generateDailyAgenda')
        .addItem('Generar Agenda Gantt', 'createAndFormatGanttAgendaPrueba')
        .addItem('Generar Reporte Semanal', 'generateWeeklyReport')
        .addToUi();
  } catch (e) {
    Logger.log('Error creando menú Agenda: ' + e.message);
  }

  // 2. NUEVO MENÚ (Sistema Integral)
  try {
    ui.createMenu('📊 Sistema Gestión')
        .addItem('Abrir Tablero (Pantalla Completa)', 'abrirTablero')
        .addSeparator()
        .addItem('📧 Enviar Reporte Semanal (PRUEBA → gerardovg)', 'lanzarReportePrueba')
        .addItem('🔬 Enviar Prueba (5 Técnicos, 6-12 Jul)', 'lanzarPruebaJulio')
        .addItem('🐛 Debug: Volcar Datos 6-12 Jul', 'dumpJulyData')
        .addItem('⏰ Activar Envío Automático (Lunes 11 AM)', 'crearTriggerSemanal')
        .addItem('⏸️ Pausar Envío Automático', 'pausarTriggerSemanal')
        .addToUi();
  } catch (e) {
    Logger.log('Error creando menú Gestión: ' + e.message);
  }

  // 3. MENÚ AUDITORÍAS SMARTCORP (simplificado y desacoplado)
  try {
    ui.createMenu('🔍 Auditorías SMARTCORP')
        // — Reportes Formularios —
        .addItem('📋 Llenar Reporte Enviado por Fecha',   'abrirDialogoFechaIndividual')
        .addItem('📅 Llenar Reporte Enviado por Periodo', 'abrirDialogoPeriodo')
        .addSeparator()
        // — Carga Manual y GitHub —
        .addItem('⚡ Ingerir y Procesar Archivos Pendientes', 'ejecutarIngerirArchivosPendientes')
        .addItem('📤 Cargar Archivo GPS Manual',           'abrirDialogoSubirGps')
        .addItem('📥 Forzar Descarga Ubiqo (GitHub)',      'ejecutarForzarDescargaUbiqoGitHub')
        .addSeparator()
        // — Procesamiento y Diagnóstico —
        .addItem('🔬 Generar Diagnóstico Detallado GPS',  'ejecutarDiagnosticoDetalladoGPS')
        .addItem('🧪 Procesar GPS en Hoja de Prueba',     'ejecutarProcesamientoGPSPrueba')
        .addItem('🔄 Recalcular Diagnóstico y Prueba',    'ejecutarRecalcularDiagnosticoYPrueba')
        .addItem('🚀 Procesar GPS en Bitácora Real',      'ejecutarProcesamientoGPS')
        .addSeparator()
        .addItem('⏰ Configurar Triggers Automáticos (2AM, 3AM, 8AM, 10PM)', 'crearTriggerIngestaNocturna')
        .addItem('ℹ️ Acerca del sistema de auditorías',   'mostrarAcercaDeAuditorias')
        .addToUi();
  } catch (e) {
    Logger.log('Error creando menú Auditorías: ' + e.message);
  }

  // 4. MENÚ VERIFICACIÓN CABLEADO (Nuevo proceso)
  try {
    ui.createMenu('Verificación Cableado')
        .addItem('Process A: Analyze Quote', 'showProcessAForm')
        .addToUi();
  } catch (e) {
    Logger.log('Error creando menú Verificación Cableado: ' + e.message);
  }
}