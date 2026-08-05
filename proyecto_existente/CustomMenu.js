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
      .addToUi();

  // 3. MENÚ AUDITORÍAS SMARTCORP (agregado 19/06/2026 — no modificar bloque anterior)
  ui.createMenu('🔍 Auditorías SMARTCORP')
      .addItem('📋 Llenar Reporte Enviado por Fecha', 'auditarReporteEnviadoPorFecha')
      .addSeparator()
      .addItem('ℹ️ Acerca del sistema de auditorías', 'mostrarAcercaDeAuditorias')
      .addToUi();
}