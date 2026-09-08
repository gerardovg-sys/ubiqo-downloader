function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // 1. TU MENÚ EXISTENTE (Agenda)
  ui.createMenu('🚀 Agenda')
      .addItem('Generar agenda', 'generateDailyAgenda')
      .addItem('Generar Agenda Gantt', 'createAndFormatGanttAgendaPrueba')
      .addItem('Generar Reporte Semanal', 'generateWeeklyReport')
      .addToUi();

  // 2. NUEVO MENÚ (Sistema Integral)
  ui.createMenu('📊 Sistema Gestión')
      .addItem('Abrir Tablero (Pantalla Completa)', 'abrirTablero')
      .addSeparator()
      .addItem('📧 Enviar Reporte Semanal (PRUEBA → gerardovg)', 'lanzarReportePrueba')
      .addItem('🔬 Enviar Prueba (5 Técnicos, 6-12 Jul)', 'lanzarPruebaJulio')
      .addItem('🐛 Debug: Volcar Datos 6-12 Jul', 'dumpJulyData')
      .addItem('⏰ Activar Envío Automático (Lunes 11 AM)', 'crearTriggerSemanal')
      .addItem('⏸️ Pausar Envío Automático', 'pausarTriggerSemanal')
      .addToUi();

  // 3. MENÚ AUDITORÍAS SMARTCORP (simplificado y desacoplado)
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

  // 4. MENÚ VERIFICACIÓN CABLEADO (Nuevo proceso)
  ui.createMenu(' Verificación Cableado')
      .addItem('Process A: Analyze Quote', 'showProcessAForm')
      .addToUi();
}