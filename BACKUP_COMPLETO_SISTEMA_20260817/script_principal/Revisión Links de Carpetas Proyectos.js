/*
================================================================================
SCRIPT: ACTUALIZACIÓN DE LINKS DE CARPETAS EXISTENTES
================================================================================

PROPÓSITO:
Este script sincroniza los enlaces de carpetas de proyectos que ya existen en
Google Drive pero que no tienen (o tienen incorrecto) el enlace en la hoja de
cálculo. Es útil para migración de proyectos existentes.

FUNCIONALIDAD:
1. Lee la hoja "BD Proyectos Maestro" de Google Sheets
2. Filtra proyectos que cumplan TODAS estas condiciones:
   - Área asignada: "Instalaciones" (configurable)
   - Categoría: "Instalación", "Servicios" o "Mantenimiento" (configurable)
   - Fecha de alta: A partir del 1 de enero de 2025 (configurable)
   - Todos los campos requeridos deben estar completos
3. Busca en la carpeta maestra si existe una carpeta con el nombre del proyecto
4. Si encuentra la carpeta, actualiza/agrega el enlace hipervínculo
5. Sobrescribe enlaces existentes si los hay

DIFERENCIAS CON EL SCRIPT DE CREACIÓN:
- NO crea carpetas nuevas, solo busca las existentes
- Actualiza enlaces incluso si ya existen en la hoja
- Útil para sincronizar después de migraciones o reorganizaciones

LOGS GENERADOS:
- Links actualizados: Nombre del proyecto, número de fila y enlace
- Proyectos sin carpeta encontrada: Para identificar carpetas faltantes

CONFIGURACIÓN:
Todos los parámetros modificables están en la sección CONFIG_LINKS_EXISTENTES

USO:
- Ejecución manual: Ejecutar función actualizarLinksCarpetasExistentes()
- Recomendado: Ejecutar una vez después de migraciones o cuando sea necesario

AUTOR: Script personalizado para sincronización de proyectos
ÚLTIMA ACTUALIZACIÓN: Octubre 2025
================================================================================
*/

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG_LINKS_EXISTENTES = {
  // IDs de Google Drive y Sheets
  spreadsheetId: '18GFvQZdpmALvmmTFc70dXENJxImMR3bkHU04IG_UyyY',
  sheetName: 'BD Proyectos Maestro',
  masterFolderId: '164CF8sASWNBAs7tjv4eMb12_KBBeLpw3',
  
  // Filtros - Puedes modificar estos valores según necesites
  areasPermitidas: ['Instalaciones'],
  categoriasPermitidas: ['Instalación', 'Servicios', 'Mantenimiento'],
  
  // Fecha límite (1 de enero de 2025)
  fechaLimite: new Date('2025-01-01'),
  
  // Nombres de columnas
  columnas: {
    fechaAlta: 'Fecha de alta',
    proyectos: 'PROYECTOS',
    areaAsignada: 'AREA ASIGNADA',
    categoria: 'Categoría',
    carpetaProyecto: 'Carpeta Proyecto'
  }
};

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================
function actualizarLinksCarpetasExistentes() {
  try {
    Logger.log('=== INICIANDO ACTUALIZACIÓN DE LINKS DE CARPETAS EXISTENTES ===');
    Logger.log(`Fecha de ejecución: ${new Date()}`);
    
    // Verificar que la carpeta maestra existe
    const carpetaMaestra = verificarCarpetaMaestraLinks();
    
    // Obtener datos de la hoja de cálculo
    const { sheet, datos, indices } = obtenerDatosHojaLinks();
    
    // Obtener carpetas existentes en la carpeta maestra
    const carpetasExistentes = obtenerCarpetasExistentesLinks(carpetaMaestra);
    
    // Procesar y actualizar links
    const resultados = procesarYActualizarLinks(datos, indices, carpetasExistentes, sheet);
    
    // Resumen final
    mostrarResumenLinks(resultados);
    
    Logger.log('=== PROCESO COMPLETADO EXITOSAMENTE ===');
    
  } catch (error) {
    Logger.log(`ERROR CRÍTICO: ${error.message}`);
    Logger.log(`Stack trace: ${error.stack}`);
    throw error;
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function verificarCarpetaMaestraLinks() {
  try {
    const carpeta = DriveApp.getFolderById(CONFIG_LINKS_EXISTENTES.masterFolderId);
    Logger.log(`✓ Carpeta maestra verificada: "${carpeta.getName()}"`);
    return carpeta;
  } catch (error) {
    throw new Error(`No se pudo acceder a la carpeta maestra con ID: ${CONFIG_LINKS_EXISTENTES.masterFolderId}`);
  }
}

function obtenerDatosHojaLinks() {
  const ss = SpreadsheetApp.openById(CONFIG_LINKS_EXISTENTES.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG_LINKS_EXISTENTES.sheetName);
  
  if (!sheet) {
    throw new Error(`No se encontró la hoja: "${CONFIG_LINKS_EXISTENTES.sheetName}"`);
  }
  
  const datosCompletos = sheet.getDataRange().getValues();
  const encabezados = datosCompletos[0];
  
  // Encontrar índices de columnas
  const indices = {
    fechaAlta: encabezados.indexOf(CONFIG_LINKS_EXISTENTES.columnas.fechaAlta),
    proyectos: encabezados.indexOf(CONFIG_LINKS_EXISTENTES.columnas.proyectos),
    areaAsignada: encabezados.indexOf(CONFIG_LINKS_EXISTENTES.columnas.areaAsignada),
    categoria: encabezados.indexOf(CONFIG_LINKS_EXISTENTES.columnas.categoria),
    carpetaProyecto: encabezados.indexOf(CONFIG_LINKS_EXISTENTES.columnas.carpetaProyecto)
  };
  
  // Verificar que todas las columnas existen
  for (const [clave, indice] of Object.entries(indices)) {
    if (indice === -1) {
      throw new Error(`No se encontró la columna: "${CONFIG_LINKS_EXISTENTES.columnas[clave]}"`);
    }
  }
  
  Logger.log(`✓ Hoja de cálculo cargada. Total de filas: ${datosCompletos.length - 1}`);
  
  return {
    sheet: sheet,
    datos: datosCompletos.slice(1), // Excluir encabezados
    indices: indices
  };
}

function obtenerCarpetasExistentesLinks(carpetaMaestra) {
  const carpetas = {};
  const iterador = carpetaMaestra.getFolders();
  
  while (iterador.hasNext()) {
    const carpeta = iterador.next();
    const nombre = carpeta.getName().trim();
    carpetas[nombre] = {
      carpeta: carpeta,
      url: carpeta.getUrl()
    };
  }
  
  Logger.log(`✓ Se encontraron ${Object.keys(carpetas).length} carpetas existentes en la carpeta maestra`);
  return carpetas;
}

function procesarYActualizarLinks(datos, indices, carpetasExistentes, sheet) {
  const resultados = {
    linksActualizados: [],
    carpetasNoEncontradas: []
  };
  
  datos.forEach((fila, index) => {
    const numeroFila = index + 2; // +2 porque empezamos desde fila 1 (encabezados) y arrays empiezan en 0
    
    const fechaAlta = fila[indices.fechaAlta];
    const nombreProyecto = fila[indices.proyectos] ? fila[indices.proyectos].toString().trim() : '';
    const areaAsignada = fila[indices.areaAsignada] ? fila[indices.areaAsignada].toString().trim() : '';
    const categoria = fila[indices.categoria] ? fila[indices.categoria].toString().trim() : '';
    
    // Verificar que las columnas obligatorias no estén vacías
    if (!fechaAlta || !nombreProyecto || !areaAsignada || !categoria) {
      return; // Saltar esta fila silenciosamente
    }
    
    // Verificar filtros
    if (!CONFIG_LINKS_EXISTENTES.areasPermitidas.includes(areaAsignada)) {
      return; // No es del área correcta
    }
    
    if (!CONFIG_LINKS_EXISTENTES.categoriasPermitidas.includes(categoria)) {
      return; // No es de una categoría permitida
    }
    
    // Convertir y verificar fecha
    const fecha = convertirFechaLinks(fechaAlta);
    if (!fecha || fecha < CONFIG_LINKS_EXISTENTES.fechaLimite) {
      return; // Fecha inválida o anterior al límite
    }
    
    // Buscar si existe la carpeta
    if (carpetasExistentes[nombreProyecto]) {
      const urlCarpeta = carpetasExistentes[nombreProyecto].url;
      
      // Actualizar el link en la hoja (sobrescribe si ya existe)
      const formula = `=HYPERLINK("${urlCarpeta}", "carpeta")`;
      sheet.getRange(numeroFila, indices.carpetaProyecto + 1).setFormula(formula);
      
      resultados.linksActualizados.push({
        nombre: nombreProyecto,
        url: urlCarpeta,
        fila: numeroFila
      });
      
      Logger.log(`✓ Link actualizado: "${nombreProyecto}" (Fila ${numeroFila})`);
      
    } else {
      // La carpeta no existe en Drive
      resultados.carpetasNoEncontradas.push({
        nombre: nombreProyecto,
        fila: numeroFila
      });
      
      Logger.log(`⚠️ Carpeta no encontrada: "${nombreProyecto}" (Fila ${numeroFila})`);
    }
  });
  
  return resultados;
}

function convertirFechaLinks(valorFecha) {
  try {
    // Si ya es un objeto Date
    if (valorFecha instanceof Date) {
      return valorFecha;
    }
    
    // Si es un string, intentar parsearlo
    if (typeof valorFecha === 'string') {
      const partes = valorFecha.split('/');
      if (partes.length === 3) {
        const dia = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1; // Los meses en JS van de 0-11
        const anio = parseInt(partes[2]);
        const anioCompleto = anio < 100 ? 2000 + anio : anio;
        return new Date(anioCompleto, mes, dia);
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

function mostrarResumenLinks(resultados) {
  Logger.log('\n=== RESUMEN DE EJECUCIÓN ===');
  
  // Links actualizados
  if (resultados.linksActualizados.length > 0) {
    Logger.log(`\n🔗 LINKS ACTUALIZADOS (${resultados.linksActualizados.length}):`);
    resultados.linksActualizados.forEach(item => {
      Logger.log(`   • "${item.nombre}" (Fila ${item.fila})`);
      Logger.log(`     Link: ${item.url}`);
    });
  } else {
    Logger.log('\n🔗 No se actualizaron links (todos los proyectos ya tenían sus links correctos o no se encontraron carpetas)');
  }
  
  // Carpetas no encontradas
  if (resultados.carpetasNoEncontradas.length > 0) {
    Logger.log(`\n⚠️ CARPETAS NO ENCONTRADAS (${resultados.carpetasNoEncontradas.length}):`);
    resultados.carpetasNoEncontradas.forEach(item => {
      Logger.log(`   • Proyecto: "${item.nombre}" (Fila ${item.fila}) - La carpeta no existe en Drive`);
    });
  }
}