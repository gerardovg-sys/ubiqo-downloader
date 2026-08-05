# 📘 Manual de Usuario Paso a Paso — Sistema de Auditorías SMARTCORP

| Campo | Detalle |
|-------|----------|
| **Dirigido a** | Personal Administrativo, Supervisores y Auxiliares |
| **Versión** | 3.0 (Guía de Uso Diario) |
| **Fecha** | 05/08/2026 |

---

## 🎯 Objetivo de este Manual
Este documento explica de forma sencilla y sin lenguaje técnico cómo utilizar el sistema de auditorías de SMARTCORP. Cualquier persona que lea esta guía podrá operar el sistema, validar los reportes de los técnicos y cargar los datos del GPS en la Bitácora sin complicaciones.

---

## ☀️ ¿Cómo Funciona la Rutina Diaria Automática?

El sistema trabaja por ti en las madrugadas para que cuando llegues a la oficina a las 8:00 AM ya tengas todo prellenado y listo para revisar:

1. **Madrugada (02:50 AM):** El sistema revisa que el archivo de telemetría de las camionetas Ubiqo haya sido descargado automáticamente.
2. **Madrugada (03:00 AM):** El sistema procesa los tramos recorridos por cada vehículo, identifica los proyectos visitados y llena la hoja borrador llamada **`Bitacora_Prueba`**.
3. **Mañana (08:00 AM):** Cuando llegas a la oficina, el borrador ya está creado con todos los kilómetros, paradas, regresos y horas calculadas.

---

## 📌 Paso a Paso: Cómo Validar y Cargar la Informacion (SOP Diario)

### **Paso 1: Abrir la Bitácora en Google Sheets**
Abre tu hoja maestra de cálculo de Google Sheets llamada **Bitácora SMARTCORP**.

---

### **Paso 2: Revisar la Hoja Borrador (`Bitacora_Prueba`)**
1. En la parte inferior de tu pantalla, haz clic en la pestaña llamada **`Bitacora_Prueba`**.
2. Verás las filas correspondientes al día de trabajo prellenadas automáticamente con:
   - 🚗 **Horas de salida y entrada** del vehículo.
   - 📍 **Llegadas y salidas** del proyecto.
   - ⏱️ **Tiempos de paradas** y conteo de **regresos**.
   - 🛣️ **Kilómetros recorridos**.
3. Revisa visualmente que las partidas coincidan con lo reportado por los supervisores.

---

### **Paso 3: Pasar los Datos a la Bitácora Real**
Una vez validada la información en `Bitacora_Prueba`:
1. Ve al menú superior de Google Sheets y haz clic en **`🔍 Auditorías SMARTCORP`**.
2. Selecciona la opción:  
   👉 **`🚀 Procesar GPS en Bitácora Real`**
3. El sistema volcará los datos a la **Bitácora Real** en **menos de 3 segundos**, protegiendo automáticamente tus fórmulas (`ID`, `SAP` y `CÁLCULO HORAS`) y auditando la columna **`REPORTE ENV.`**.

---

## 🛠️ ¿Qué Hacer Si Necesitas Cargar un Archivo Manualmente?

Si por alguna razón necesitas cargar un archivo GPS a deshoras o de forma manual:

### Opción A: Forzar la Descarga Automática de Ubiqo
1. En el menú superior, haz clic en **`🔍 Auditorías SMARTCORP`**.
2. Selecciona **`📥 Forzar Descarga Ubiqo (GitHub)`**.
3. Espera 30 segundos y la información se descargará sola desde la plataforma de Ubiqo.

### Opción B: Subir un Archivo Excel desde tu Computadora
1. En el menú superior, haz clic en **`🔍 Auditorías SMARTCORP`**.
2. Selecciona **`📤 Cargar Archivo GPS Manual`**.
3. Se abrirá una ventana emergente. Arrastra o selecciona tu archivo Excel `.xlsx` de Ubiqo y haz clic en **Guardar**.
4. El sistema procesará el archivo y prellenará `Bitacora_Prueba` automáticamente.

---

## ❓ Preguntas Frecuentes y Significado de Códigos

### ¿Qué significan las letras en la columna `REPORTE ENV.`?

| Código | Color | Significado | ¿Qué debes hacer? |
| :---: | :---: | :--- | :--- |
| **`SI`** | Verde | El técnico envió su reporte a tiempo el mismo día. | Ninguna, todo correcto. |
| **`FT`** | Amarillo | El técnico envió el reporte, pero lo llenó días después (**Fuera de Tiempo**). | Notificar al técnico para que reporte el mismo día. |
| **`NO`** | Rojo | El técnico **NO envió reporte** para esa visita. | Solicitar al técnico que llene su reporte de inmediato. |
| **`NA`** | Gris | No aplica reporte (ej: día libre, permiso, oficina o gastos). | Todo correcto, no requiere reporte. |

---

## 🚨 Soporte y Ayuda
Si observas alguna alerta inusual o requieres asistencia con el sistema, contacta al departamento de Sistemas y Automatización de SMARTCORP.
