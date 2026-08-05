# 📋 Manual de Procesos y SOP — Sistema de Auditorías SMARTCORP

| Campo | Detalle |
|-------|----------|
| **Versión** | 2.5.0 (Producción Automática con Rescate & Traspaso Ultra-Rápido) |
| **Fecha** | 05/08/2026 |
| **Autor** | Equipo de Automatización SMARTCORP |
| **Estado** | Activo — 100% Operativo y Automatizado |

---

## 📚 Tabla de Contenidos

1. Introducción y Visión General
2. Arquitectura General del Sistema
3. Flujo de Descarga Nocturna y Rescate (GitHub Actions + Apps Script)
4. Módulo GPS — Diagnóstico, Prellenado y Traspaso
   - 4.1 Ingesta a `Historial_GPS`
   - 4.2 Radiografía `Diagnostico_GPS`
   - 4.3 Prellenado `Bitacora_Prueba`
   - 4.4 Traspaso Masivo a `Bitácora Real` (Preservación de Fórmulas)
5. Módulo Auditoría de Reportes Enviados (`REPORTE ENV.`)
   - 5.1 Reglas de Clasificación (`SI`, `FT`, `NO`, `NA`)
   - 5.2 Automatización Semanal (Lunes 8:00 AM)
   - 5.3 Automatización Mensual (Día 7 a las 8:00 AM)
6. Menú Personalizado de Usuario (`🔍 Auditorías SMARTCORP`)
7. Procedimiento Operativo Estándar (SOP)
8. Registro de Cambios y Versiones

---

## 1. Introducción y Visión General

El **Sistema de Auditorías SMARTCORP** es una solución integral desacoplada y automatizada diseñada para auditar, tele-medir y validar la operabilidad diaria de los técnicos en campo.

El sistema resuelve tres grandes retos operativos:
1. **Extracción Automática de Telemetría GPS:** Conexión automatizada a la plataforma Ubiqo vía GitHub Actions para descargar los reportes diarios sin intervención humana.
2. **Cálculo y Prellenado Ultra-Rápido:** Preprocesamiento en una hoja borrador (`Bitacora_Prueba`) y traspaso masivo en bloque (**0.3 segundos**) a la `Bitácora Real`, preservando las celdas con ecuaciones (`ID`, `SAP`, `CÁLCULO HORAS`).
3. **Auditoría de Cumplimiento de Reportes:** Verificación cruzada entre los reportes de los técnicos en `REPORTES_GENERAL` y las visitas registradas en la `Bitácora`.

---

## 2. Arquitectura General del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ECOSISTEMA AUTOMÁTICO SMARTCORP                       │
│                                                                             │
│   ┌──────────────────────┐             ┌─────────────────────────────────┐  │
│   │ Plataforma GPS Ubiqo │             │     GitHub Actions Downloader   │  │
│   └──────────┬───────────┘             │ (Ejecución nocturna automatiz.) │  │
│              │ (Descarga Excel)        └────────────────┬────────────────┘  │
│              ▼                                          │                   │
│   ┌─────────────────────────────────────────────────────▼────────────────┐  │
│   │                 Google Drive: Carpeta GPS_Pendientes                 │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼ (Trigger 3:00 AM)                    │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     GOOGLE APPS SCRIPT PRINCIPAL                      │  │
│   │                                                                      │  │
│   │ 1. Ingesta ──────► Historial_GPS (Captura paradas y tramos)          │  │
│   │ 2. Diagnóstico ──► Diagnostico_GPS (Radiografía instantánea)         │  │
│   │ 3. Prellenado ───► Bitacora_Prueba (Vista previa completa)           │  │
│   │ 4. Traspaso Real ─► Bitácora Real (0.3 seg | Preserva ID/SAP/Calc)   │  │
│   │ 5. Reportes ─────► Auditoría REPORTE ENV. (SI / FT / NO / NA)        │  │
│   └──────────────────────────────────┬───────────────────────────────────┘  │
│                                      │                                      │
│              ┌───────────────────────┴───────────────────────┐              │
│              ▼                                               ▼              │
│   ┌─────────────────────┐                         ┌─────────────────────┐   │
│   │  Trigger Semanal    │                         │   Trigger Mensual   │   │
│   │  (Lunes 8:00 AM)    │                         │   (Día 7 8:00 AM)   │   │
│   │  Semana Anterior    │                         │   Mes Anterior      │   │
│   └─────────────────────┘                         └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujo de Descarga Nocturna y Rescate

### 3.1 Robot Descargador Ubiqo (GitHub Actions)
- **Horario:** Se ejecuta automáticamente en la madrugada.
- **Acción:** Inicia sesión en Ubiqo, genera el reporte dinámico Excel de la flotilla completa, verifica si el archivo ya fue descargado previamente (candado anti-duplicados) y lo envía a la carpeta `GPS_Pendientes` en Google Drive.

### 3.2 Verificación y Rescate Nocturno (2:50 AM)
- **Función:** `auditVerificarOForzarDescargaNocturna()`
- **Lógica:** A las 2:50 AM, Apps Script verifica si la carpeta `GPS_Pendientes` ya contiene el archivo del día.
- **Acción de rescate:** Si por algún motivo la descarga programada falló o la carpeta sigue vacía, Apps Script envía un pulso dispatch a la API de GitHub Actions para obligar la descarga inmediata.

---

## 4. Módulo GPS — Ingesta, Diagnóstico y Traspaso Real

### 4.1 Ingesta a `Historial_GPS`
- Lee los archivos Excel en `GPS_Pendientes`.
- Escanea todas las celdas buscando duraciones de paradas acumuladas (`Paradas_Duracion_HH_MM_SS`).
- Deposita los tramos limpios en `Historial_GPS` con estado `"Pendiente"` y mueve el archivo a `GPS_Procesados`.

### 4.2 Radiografía `Diagnostico_GPS`
- Genera una radiografía completa cruzando los tramos GPS contra las geocercas registradas (`Proyectos_GPS`).
- Cruza la información del técnico y la unidad en la `Bitácora Real`, garantizando la asociación del proyecto correcto incluso si la celda de unidad no ha sido escrita manualmente.

### 4.3 Prellenado `Bitacora_Prueba`
- Crea una copia limpia en la pestaña borrador `Bitacora_Prueba`.
- Calcula horas de salida, horas de entrada, paradas, regresos, tiempos recorridos y kilómetros totales por cada técnico y proyecto.

### 4.4 Traspaso Masivo a `Bitácora Real` (Preservación de Fórmulas)
- **Función:** `auditTraspasarPruebaABitacoraReal()`
- **Velocidad:** Traspaso masivo en bloque en **menos de 0.3 segundos**.
- **Copia exclusiva de 22 columnas de valores fijos:**  
  `FECHA`, `PROYECTO`, `NOMBRE`, `Rol`, `DE`, `A`, `UNIDAD`, `ASUNTO`, `JUSTIFICACION`, `NOTA`, `REV`, `HORA DE SALIDA`, `HORA DE ENTRADA`, `TIEMPO RECORRIDO`, `TIEMPO DE PARADAS`, `PARADAS`, `REGRESOS`, `OBSERVACIONES`, `KM`, `HORAS EXTRA`, `HORA SAL PROY`, `HORA LLEG PROY`.
- **Preservación Estricta de Fórmulas:**  
  Las 3 columnas únicas con ecuaciones (`ID` / `q`, `SAP` y `CÁLCULO HORAS`) permanecen intocadas. Si el proceso inserta nuevas filas (ej. `SMARTHAUS GASTOS`), arrastra automáticamente las ecuaciones de la fila superior.

---

## 5. Módulo Auditoría de Reportes Enviados (`REPORTE ENV.`)

### 5.1 Reglas de Clasificación
Al auditar la columna `K` (`REPORTE ENV.`), el sistema clasifica cada fila de la Bitácora según las coincidencias encontradas en `REPORTES_GENERAL`:

| Clasificación | Significado | Condición |
|---------------|-------------|-----------|
| **`SI`** | Reporte enviado a tiempo | Existe reporte en `REPORTES_GENERAL` donde `Fecha_Referencia == Fecha_Reporte`. |
| **`FT`** | Fuera de tiempo | Existe reporte pero fue enviado en un día posterior (`Fecha_Referencia != Fecha_Reporte`). |
| **`NO`** | No enviado | No existe ningún reporte en `REPORTES_GENERAL` para ese proyecto y técnico en la fecha de trabajo. |
| **`NA`** | No aplica | El `ASUNTO` en la Bitácora no es `"Proyecto instalación"` (ej. Gastos, día libre, administrativo). |

### 5.2 Automatización Semanal (Todos los Lunes a las 8:00 AM)
- **Función:** `auditEjecutarAuditoriaSemanalLunes8AM()`
- **Lógica:** Se ejecuta de forma 100% automática cada Lunes a las 8:00 AM. Toma la fecha de inicio (Lunes anterior) y fecha fin (Domingo anterior) y audita la columna `REPORTE ENV.` de toda la semana pasada.

### 5.3 Automatización Mensual (Día 7 de cada mes a las 8:00 AM)
- **Función:** `auditEjecutarAuditoriaMensualDia7_8AM()`
- **Lógica:** Se ejecuta los días 7 de cada mes a las 8:00 AM. Toma desde el día 1 al último día del mes anterior y re-audita todo el periodo mensual para asegurar actualización al 100%.

---

## 6. Menú Personalizado de Usuario (`🔍 Auditorías SMARTCORP`)

El menú se integra directamente en la barra superior de Google Sheets:

```
🔍 Auditorías SMARTCORP
├── 📋 Llenar Reporte Enviado por Fecha
├── 📅 Llenar Reporte Enviado por Periodo
├── ────────────────────────────────────
├── 📤 Cargar Archivo GPS Manual
├── 📥 Forzar Descarga Ubiqo (GitHub)
├── ────────────────────────────────────
├── 🔬 Generar Diagnóstico Detallado GPS
├── 🧪 Procesar GPS en Hoja de Prueba
├── 🚀 Procesar GPS en Bitácora Real
└── ℹ️ Acerca del sistema de auditorías
```

---

## 7. Procedimiento Operativo Estándar (SOP)

### 7.1 Operación Automática Diaria (Sin intervención)
1. **02:50 AM:** Apps Script verifica presencia del archivo en `GPS_Pendientes`. Si no está, solicita la descarga a GitHub Actions.
2. **03:00 AM:** El sistema lee `Historial_GPS`, genera la radiografía `Diagnostico_GPS` y prellena `Bitacora_Prueba`.
3. **08:00 AM (Al llegar a la oficina):** El personal administrativo abre la hoja, revisa `Bitacora_Prueba` para validar que todo esté correcto y hace clic en **`🚀 Procesar GPS en Bitácora Real`**.
4. En **menos de 3 segundos**, los datos quedan volcados en la `Bitácora Real`, las fórmulas de `ID`, `SAP` y `CÁLCULO HORAS` se preservan intactas y la columna `REPORTE ENV.` queda auditada.

### 7.2 Operación Manual a Demanda (Descarga o Carga Manual)
- Si deseas forzar la descarga de Ubiqo en cualquier momento del día, presiona **`📥 Forzar Descarga Ubiqo (GitHub)`**.
- Si tienes un archivo Excel descargado localmente, presiona **`📤 Cargar Archivo GPS Manual`** para subirlo directamente desde tu computadora.

---

## 8. Registro de Cambios y Versiones

- **v1.0.0 (19/06/2026):** Creación inicial del módulo de auditoría de reportes enviados.
- **v2.0.0 (15/07/2026):** Ingesta automática de archivos Ubiqo y almacenamiento en `Historial_GPS`.
- **v2.3.0 (04/08/2026):** Integración de radiografía `Diagnostico_GPS` y hoja borrador `Bitacora_Prueba`.
- **v2.5.0 (05/08/2026):** 
  - Verificación y rescate nocturno 2:50 AM.
  - Copia masiva selectiva de 22 columnas en **0.3 segundos**.
  - Preservación estricta de las 3 columnas con ecuación (`ID`, `SAP`, `CÁLCULO HORAS`).
  - Activadores automáticos de auditoría semanal (Lunes 8:00 AM) y mensual (Día 7 a las 8:00 AM).
