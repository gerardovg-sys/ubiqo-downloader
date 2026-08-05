# 📜 Catálogo Maestro de Reglas de Negocio GPS y Reportes Enviados — SMARTCORP
*Versión 5.0 — 05 Aug 2026 — Documento de Verdad Absoluta*

> **Este es el documento SOP (Standard Operating Procedure) y Reglas de Negocio del sistema SMARTCORP.**
> Antes de cualquier cambio al código, se consulta y actualiza este documento.
> Cuando se aprueba, sirve como guía permanente del sistema.

---

## 🏗️ FUENTES DE DATOS — ¿De dónde saca la información el sistema?

| Fuente | Pestaña | Qué contiene |
| :--- | :--- | :--- |
| **Bitácora** | `Bitácora` | Nombre técnico, proyecto, unidad, fecha, DE, A, Rol, SAP, REPORTE ENV., ASUNTO |
| **Reportes Enviados** | `REPORTES_GENERAL` | Fecha_Reporte, NombreProyecto, Fecha_Referencia, Equipo_Trabajo_Manual |
| **Geocercas** | `Proyectos_GPS` | `ID_Proyecto`, `Nombre_Proyecto`, `Latitud`, `Longitud`, `Radio_Geocerca_Metros` |
| **Proyectos Especiales** | `Proyectos_Especiales` | Lista de nombres de proyectos especiales (una por fila, columna A) |
| **Equivalencia Unidades** | `Relacion_Unidades` | Nombre del GPS ↔ Nombre en Bitácora |
| **Rutas GPS** | `Historial_GPS` | Tramos: unidad, fecha, hora inicio/fin, lat/lon, distancia, duración, paradas |

---

## 🔄 AUTOMATIZACIÓN Y CICLO DE VIDA DE DATOS

### 1. Robot Descargador Ubiqo (GitHub Actions) + Rescate (02:50 AM)
- **Ejecución Nocturna:** Un robot de Python alojado en GitHub Actions descarga el reporte dinámico Excel de Ubiqo de la flotilla completa y lo deposita en `GPS_Pendientes`.
- **Candado Anti-Duplicados:** Verifica si ya existe un reporte para la fecha actual antes de descargar para prevenir archivos duplicados.
- **Rescate a las 2:50 AM:** Apps Script verifica si `GPS_Pendientes` contiene archivo. Si no lo hay, envía una señal API dispatch a GitHub Actions para obligar la descarga inmediata.

### 2. Cadena Nocturna de Ingesta, Diagnóstico y Prellenado (03:00 AM)
- **Ingesta:** Extrae tramos y paradas acumuladas (`Paradas_Duracion_HH_MM_SS`) y los registra en `Historial_GPS`.
- **Diagnóstico:** Genera la radiografía en `Diagnostico_GPS` asociando geocercas, unidades y técnicos.
- **Borrador de Prueba:** Prellena la hoja borrador `Bitacora_Prueba` para revisión del usuario.

### 3. Traspaso Masivo a `Bitácora Real` (0.3 Segundos)
- **Acción Manual:** Al llegar a la oficina, el usuario revisa la `Bitacora_Prueba` y da clic en **`🚀 Procesar GPS en Bitácora Real`**.
- **Copia Selectiva:** Copia únicamente **22 columnas de valores fijos** (`FECHA`, `PROYECTO`, `NOMBRE`, `Rol`, `DE`, `A`, `UNIDAD`, `ASUNTO`, `JUSTIFICACION`, `NOTA`, `REV`, `HORA DE SALIDA`, `HORA DE ENTRADA`, `TIEMPO RECORRIDO`, `TIEMPO DE PARADAS`, `PARADAS`, `REGRESOS`, `OBSERVACIONES`, `KM`, `HORAS EXTRA`, `HORA SAL PROY`, `HORA LLEG PROY`).
- **Preservación de Fórmulas:** Las 3 columnas únicas con ecuaciones (`ID` / `q`, `SAP` y `CÁLCULO HORAS`) se preservan intactas. Si se insertan filas nuevas (`SMARTHAUS GASTOS`), se arrastran las ecuaciones automáticamente.

### 4. Re-Auditorías Automáticas Programadas (`REPORTE ENV.`)
- **Auditoría Semanal (Lunes 8:00 AM):** Re-audita automáticamente toda la semana anterior completa (del Lunes previo al Domingo previo).
- **Auditoría Mensual (Día 7 a las 8:00 AM):** Re-audita todo el mes anterior completo de principio a fin (día 1 al último día) para asegurar actualización al 100%.

---

## 🔴 ESTADO DE REGLAS DE NEGOCIO Y MEJORAS

| # | Descripción | Impacto | Estado |
| :---: | :--- | :---: | :---: |
| **1** | Módulo de Auditoría de Reportes Enviados (`REPORTE ENV.`) con clasificación `SI`, `FT`, `NO`, `NA` | Alto | ✅ Implementado (v5.0) |
| **2** | Alineación de límites en cambio de unidad (Caso Velozit) usando geocercas en cuadrilla | Alto | ✅ Implementado (v5.0) |
| **3** | Horario por defecto 08:00 a 18:00 para partidas con `UNIDAD = NA` | Medio | ✅ Implementado (v5.0) |
| **4** | Descargador Ubiqo GitHub Actions con candado anti-duplicados y rescate a las 2:50 AM | Alto | ✅ Implementado (v5.0) |
| **5** | Radiografía instantánea `Diagnostico_GPS` y vista previa en `Bitacora_Prueba` | Alto | ✅ Implementado (v5.0) |
| **6** | Traspaso masivo a `Bitácora Real` (0.3s) copiando 22 columnas de valores y preservando fórmulas (`ID`, `SAP`, `CÁLCULO HORAS`) | Alto | ✅ Implementado (v5.0) |
| **7** | Triggers programados de auditoría: Semanal (Lunes 8AM) y Mensual (Días 7 8AM) | Alto | ✅ Implementado (v5.0) |

### Proyectos Internos del Sistema (Siempre Especiales Sin Necesitar Configuración)
Estos tres nombres son reservados por el propio sistema. Cuando aparecen en la Bitácora se tratan idéntico a los proyectos especiales: sin alertas GPS, sin validar geocerca de cliente, sin horas de sal/lleg proyecto.

| Nombre | Qué es |
| :--- | :--- |
| `SMARTHAUS GASTOS` | Fila administrativa que el sistema inserta automáticamente para cubrir huecos de inicio tardío o retorno temprano. |
| `OFICINA` | Proyecto interno administrativo. |
| `SMARTCORP` | Proyecto interno administrativo. |

### Cómo funciona la detección de geocercas (2 niveles de tolerancia)

**Nivel 1 — Radio exacto configurado:**
El punto GPS cae dentro del radio configurado en `Radio_Geocerca_Metros` de `Proyectos_GPS`. Radio por defecto si la columna está vacía: **100 metros**.

**Nivel 2 — Proximidad Inteligente:**
Si el punto GPS no cayó dentro del radio exacto, pero el proyecto de la Bitácora tiene geocerca registrada y el punto está a menos de **1,500 metros**, el sistema asume que el técnico sí estaba en ese proyecto.
*(Aumentado de 1,000m a 1,500m para cubrir plantas grandes, estacionamientos externos, etc. El sistema siempre prioriza el proyecto que aparece en la Bitácora.)*

### Equivalencia de Nombres de Unidades
Si el GPS registra `SH-U30-Frontier 2` y la Bitácora dice `30 (Frontier 2)`, la pestaña `Relacion_Unidades` hace la traducción. Sin esta relación, la unidad no tendrá GPS cruzado.

---

## 📋 MÓDULO — AUDITORÍA DE REPORTES ENVIADOS (Columna K — `REPORTE ENV.`)

### Propósito
Verificar de forma automatizada si cada técnico registró su formulario de reporte diario en la hoja maestra **`REPORTES_GENERAL`** para las partidas asignadas en la **`Bitácora`**.

### Reglas de Clasificación (Valores Válidos en Columna `REPORTE ENV.`)

| Código | Significado | Condición Exacta de Negocio |
| :---: | :--- | :--- |
| **`SI`** | Reporte enviado a tiempo | Existe al menos un registro en `REPORTES_GENERAL` para ese técnico y proyecto donde `Fecha_Referencia == Fecha_Reporte` (se llenó el mismo día de trabajo). |
| **`FT`** | Fuera de Tiempo | Existen reportes en `REPORTES_GENERAL` para ese técnico y proyecto, pero TODOS fueron enviados en una fecha posterior (`Fecha_Referencia ≠ Fecha_Reporte`). |
| **`NO`** | No enviado | El `ASUNTO` es `"Proyecto instalación"` en un proyecto normal, pero NO se encontró ningún reporte registrado para ese técnico y proyecto en esa fecha. |
| **`NA`** | No Aplica | Aplica obligatoriamente cuando se cumple **CUALQUIERA (LÓGICA O / OR)** de las siguientes condiciones:<br>1. El `ASUNTO` en la Bitácora **NO** es igual a `"Proyecto instalación"` (ej: `Oficina`, `SMARTHAUS GASTOS`, `Traslado`, `Capacitación`, `Permiso`, etc.).<br>2. El proyecto es un **Proyecto Especial** registrado en la pestaña `Proyectos_Especiales` (incluso si la fila dice `Proyecto instalación`).<br>3. El proyecto es un proyecto interno del sistema (`SMARTHAUS GASTOS`, `OFICINA`, `SMARTCORP`). |

### Criterios de Coincidencia (Match Triclave)
Para que un reporte de `REPORTES_GENERAL` enlace con un renglón de la `Bitácora`, deben coincidir simultáneamente 3 campos:
1. **Fecha de Trabajo:** `Bitácora.FECHA == REPORTES_GENERAL.Fecha_Referencia`
2. **Proyecto:** `Bitácora.PROYECTO == REPORTES_GENERAL.NombreProyecto` (normalizado sin espacios extra ni acentos).
3. **Técnico:** `Bitácora.NOMBRE` debe coincidir **EXACTAMENTE** con el nombre completo registrado en `REPORTES_GENERAL.Equipo_Trabajo_Manual` (normalizado sin mayúsculas/acentos y separado por comas). **No se permiten coincidencias parciales por primer nombre** para evitar atribuciones incorrectas entre técnicos que comparten el mismo primer nombre (ej. múltiples "Juan" o "José").

### Regla de Prioridad con Múltiples Reportes
Si un técnico tiene 2 o más reportes para el mismo proyecto y fecha:
- Si al menos uno tiene `Fecha_Referencia == Fecha_Reporte`, el resultado final es **`SI`**.
- Solo se asigna **`FT`** si **TODOS** los reportes encontrados fueron fuera de fecha.

---

## 🔝 JERARQUÍA DE EVALUACIÓN GPS — Orden de prioridad

| # | Caso | Cuándo aplica |
| :---: | :--- | :--- |
| **1** | Fuera de horario normal (<06:00 o ≥18:00) | GPS o Bitácora fuera del rango 06:00–18:00 |
| **2** | Sin datos GPS (Unidad = NA o sin rutas) | No hay telemetría disponible (Fija horario 08:00 a 18:00) |
| **3** | Proyecto Especial — Único en el día | Solo un proyecto especial |
| **4** | Proyectos Especiales — Múltiples | Varios proyectos, al menos uno especial |
| **5** | Proyecto Normal — Único en el día | Un solo proyecto normal |
| **6** | Proyecto Normal — Múltiples, misma unidad | Varios normales, misma unidad |
| **7** | Proyecto Normal — Múltiples, distintas unidades | Técnico cambia vehículo en el día |
| **8** | Retorno al mismo proyecto (Regresos) | Vuelve a SMARTCORP y regresa al mismo proyecto |
| **9** | Parada de comida fuera de geocercas conocidas | Detención intermedia no registrada (45 min – 2 hr) |
| **10** | Dos técnicos, misma unidad, mismo día | Unidad compartida en horario normal y nocturno |
| **11** | Pérdida de señal GPS / Brecha de coordenadas | GPS pierde cobertura temporal |
| **12** | Parada Prolongada Desconocida (>90 min) | Vehículo parado en lugar no registrado |
| **13** | Retorno Temprano (antes de 17:00) | Vehículo regresa a oficina antes del umbral |
| **14** | Inicio Tardío (después de 09:00) | Vehículo sale de oficina después del umbral |
| **15** | Horas Extra (regresa después de 19:00) | Vehículo regresa después del umbral nocturno |

---

## 📊 TABLA MAESTRA DE COLUMNAS GPS (Horario Estándar 08:00 a 18:00)

Esta es la tabla central de referencia. Determina **qué escribe el script en cada columna** según la posición del proyecto en el día y su tipo.

### Regla Base (sin excepciones)

| Posición | Tipo | `DE` | `A` | `HORA SALIDA` | `HORA ENTRADA` | `HORA SAL PROY` | `HORA LLEG PROY` | `KM` | `TIEMPO REC.` | Alertas GPS |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Único** | Normal | 08:00 | 18:00 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Único** | Especial | 08:00 | 18:00 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Primero** | Normal | 08:00 | Corte | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Primero** | Especial | 08:00 | Corte | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Último** | Normal | Corte | 18:00 | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Último** | Especial | Corte | 18:00 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Intermedio** | Normal | Corte | Corte | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Intermedio** | Especial | Corte | Corte | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

**Clave de "Corte":** La hora calculada por el sistema en la segmentación entre proyectos (retorno a oficina, midpoint, etc.), siempre redondeada al siguiente cuarto de hora (15 min).

### Reglas de Forzado de Horario Matutino y Vespertino

1. **Regla Matutina (08:00 - 09:00):**
   - Si la salida de oficina ocurre entre las **08:00 y 09:00**, se fuerza `DE = 08:00`.
   - Si la salida ocurre **después de las 09:00**, se genera la fila administrativa `SMARTHAUS GASTOS` de 08:00 a la hora de salida (redondeada a 15 min) y el proyecto inicia a esa hora real.
   - Si la salida ocurre **antes de las 08:00**, se registra la hora real redondeada a 15 min (sin forzar 08:00).

2. **Regla Vespertina (17:00 - 18:00):**
   - Si el retorno a oficina ocurre entre las **17:00 y 18:00**, se fuerza `A = 18:00`.
   - Si el retorno ocurre **después de las 19:00**, se coloca en `A` la hora real de arribo (redondeada a 15 min superiores) y se calcula `HORAS EXTRA` (Total horas trabajadas - 10.0 horas de jornada).

### ⚠️ Excepciones que sobrescriben la Regla Base

Hay dos situaciones especiales que hacen que un proyecto normal se comporte similar a un especial en ciertas columnas:

#### Excepción A — Salida Muy Temprana (antes de 06:00)
Aplica al proyecto que es **primero del día o único** cuando el GPS muestra que el vehículo salió antes de las 06:00 AM.

| Columna | Comportamiento Normal | Con Excepción A |
| :--- | :---: | :---: |
| `HORA SALIDA` | ✅ se escribe | ❌ vacío (para no contaminar métricas) |
| `HORA LLEG PROY` | ✅ se escribe | ❌ vacío (para no contaminar métricas) |
| `DE` | `08:00` forzado | `08:00` forzado (igual) |
| `REV` | `""` | `"REVISAR"` |
| `OBSERVACIONES` | — | `[GPS] Salida muy temprana detectada (HH:MM). Revisar.` |

#### Excepción B — Horas Extra (regreso después de 19:00)
Aplica al proyecto que es **último del día o único** cuando el GPS muestra que el vehículo regresó después de las 19:00 PM.

| Columna | Comportamiento Normal | Con Excepción B |
| :--- | :---: | :---: |
| `HORA ENTRADA` | ✅ se escribe | ❌ vacío (para no contaminar métricas) |
| `HORA SAL PROY` | ✅ se escribe | ❌ vacío (para no contaminar métricas) |
| `A` | `18:00` forzado | `18:00` forzado (igual) |
| `HORAS EXTRA` | `""` | `Hora arribo real - 18.0` |

### Alertas GPS para Proyectos Normales (columna `OBSERVACIONES` + `REV`)
Los proyectos normales pueden generar las siguientes alertas. Los especiales nunca generan alertas.

| # | Alerta | Condición | `REV` | Acción adicional |
| :---: | :--- | :--- | :---: | :--- |
| A | No visita a geocerca del proyecto | GPS no detectó el vehículo en el radio del proyecto (ni con proximidad inteligente) | `REVISAR` | `OBSERVACIONES`: `[GPS] REVISAR: El vehiculo no visito la geocerca de este proyecto.` |
| B | Inicio tardío | El vehículo salió después de las **09:00 AM** | `""` | Inserta fila `SMARTHAUS GASTOS` de 08:00 a hora de salida, marcada `REVISAR` |
| C | Retorno temprano | El vehículo llegó antes de las **17:00 PM** | `""` | Inserta fila `SMARTHAUS GASTOS` de hora de llegada a 18:00, marcada `REVISAR` |
| D | Horas extra | El vehículo llegó después de las **19:00 PM** | `""` | Calcula `HORAS EXTRA = hora real - 18.0`. Vacía `HORA ENTRADA` y `HORA SAL PROY` |
| E | Salida muy temprana | El vehículo salió antes de las **06:00 AM** | `REVISAR` | Vacía `HORA SALIDA` y `HORA LLEG PROY`. `OBSERVACIONES`: alerta de salida temprana |
| F | Parada prolongada desconocida | El vehículo estuvo >90 min en un lugar no registrado | `REVISAR` | Inserta fila nueva como proyecto no registrado (ver Caso 12) |

---

## 🌙 CASO 1 — Turno Fuera del Horario Normal (<06:00 o ≥18:00)

### Definición
- **Horario Normal:** 06:00 AM – 18:00 PM.
- **Fuera de horario:** GPS muestra movimiento **exclusivamente** fuera de ese rango, Y la Bitácora tiene horas `DE`/`A` fuera del rango.

**¿Qué NO es turno fuera de horario?**
- Técnico trabajó en día y regresó después de las 18:00 → **Horas Extra** (Caso 15).
- Técnico salió antes de las 06:00 pero estuvo en campo durante el día → **Excepción A** (ver tabla de columnas).

> ⚠️ **Corrección pendiente en código:** El umbral actual es `≥20:00`. Debe cambiarse a `≥18:00`.

### Qué hace el script
- Preserva `DE` y `A` originales de la Bitácora.
- Vacía: `HORA SALIDA`, `HORA ENTRADA`, `KM`, `TIEMPO RECORRIDO`, `PARADAS`, `TIEMPO PARADAS`, `REGRESOS`, `HORA SAL PROY`, `HORA LLEG PROY`.
- `OBSERVACIONES`: `[GPS] Turno fuera de horario normal detectado.`
- `REV = "REVISAR"`.

### Caso: Unidad compartida día + noche (pendiente de implementar)
Cuando la misma unidad fue usada por Técnico A en horario normal y Técnico B en horario nocturno:
1. Rutas de 06:00–18:00 → Técnico A → reglas normales.
2. Rutas de 18:00–06:00 → Técnico B → turno fuera de horario.
3. Se confirma asignación comparando geocercas tocadas con proyectos de cada técnico.

### 🗂️ Ejemplo
> **Técnico A:** Proyecto normal de día en PICK-UP 01.
> **Técnico B:** `INT QRO SOPORTE NOCTURNO` de noche, misma unidad.
> **Resultado A:** KMs, geocercas, alertas procesados normalmente.
> **Resultado B:** `DE` y `A` preservados. Todo GPS vacío. Sin alertas.

---

## ❌ CASO 2 — Sin Datos GPS (Unidad = NA o sin rutas)

| Tipo de proyecto | Comportamiento |
| :--- | :--- |
| **Normal** | `REV = "REVISAR"`. `OBSERVACIONES`: `[GPS] REVISAR: Esta partida no tiene unidad asignada.` Todas las columnas GPS vacías. |
| **Especial** | Sin REVISAR. `DE`/`A` según posición en el día. `KM` y `TIEMPO RECORRIDO` vacíos. |

---

## 📋 CASO 3 — Proyecto Especial, Único en el Día

**Regla:** `DE = 08:00`, `A = 18:00`. Si hay GPS: `KM` y `TIEMPO RECORRIDO` calculados. Todo lo demás vacío. Sin alertas.
* **Exención de Filas Administrativas:** Los proyectos especiales únicos en el día (ej. `"INT QRO MTTO PERSONAL 2605"`) están exentos de alertas de inicio tardío/retorno temprano, y nunca generarán filas de ajuste `SMARTHAUS GASTOS` ni de retorno temprano.

### 🗂️ Ejemplo
> `INT QRO MTTO PERSONAL 2605`. GPS: 45 km, salió 10:00, regresó 14:30.
> **Resultado:** `DE = 08:00`, `A = 18:00`, `KM = 45`, `TIEMPO RECORRIDO = 4:30:00`. Todo lo demás vacío.

---

## 🔗 CASO 4 — Proyectos Especiales Múltiples (Especial+Especial o Especial+Normal)

**Regla:** Aplicar la tabla maestra de columnas según posición + tipo de cada proyecto.
La segmentación horaria (cálculo del "Corte") sigue los mismos métodos del Caso 6.

### 🗂️ Ejemplo Especial (1°) + Normal (último)
> Fila 1: Especial. Fila 2: Normal.
> GPS: Salió 08:20, zona especial hasta 11:00, regresó oficina 11:30, salió a obra 12:15, llegó obra 12:45, salió obra 18:30, llegó oficina 19:10.
>
> **Resultado Fila 1 (Especial · Primero):**
> `DE = 08:00` | `A = 11:30` (corte: llegada a oficina) | `KM = 45` | `TIEMPO RECORRIDO = 2:40:00`
> `HORA SALIDA = ""` | `HORA ENTRADA = ""` | `HORA SAL PROY = ""` | `HORA LLEG PROY = ""` | Sin alertas.
>
> **Resultado Fila 2 (Normal · Último — con Excepción B por regreso a 19:10):**
> `DE = 11:30` | `A = 18:00` | `KM = 80` | `TIEMPO RECORRIDO = 5:00:00`
> `HORA SALIDA = ""` (no es primero) | `HORA ENTRADA = ""` (Excepción B: horas extra) | `HORA SAL PROY = ""` (Excepción B) | `HORA LLEG PROY = ""` (no es primero)
> `HORAS EXTRA = 19.17 - 18.0 = 1.17` | Validación de geocerca activa.

---

## 🏭 CASO 5 — Proyecto Normal, Único en el Día

**Regla:** Aplica la tabla maestra fila "Único + Normal". Todas las columnas activas. Todas las alertas activas.

### 🗂️ Ejemplo
> GPS: Salió 08:30, llegó obra 09:15, salió obra 16:00, regresó 17:10.
> `DE = 08:00` | `A = 18:00` | `HORA SALIDA = 08:30` | `HORA ENTRADA = 17:10` | `HORA LLEG PROY = 09:15` | `HORA SAL PROY = 16:00` | `KM = 60`.

### ⚠️ Sub-Caso 5B — Excepción por GPS Fantasma o Sin Visita a Geocerca (`sinGeocerca = true`)
- Si el vehículo no tocó la geocerca registrada del proyecto (`sinGeocerca = true`), o si las lecturas de los extremos producen anomalías (ej. `HORA SAL PROY` idéntica a `HORA DE SALIDA`, o `HORA LLEG PROY` idéntica a `HORA ENTRADA`):
- **Acción:** **SE SUPRIMEN (vacían) `HORA SAL PROY` y `HORA LLEG PROY`**.
- **Alertas y Métricas:** Se conserva la alerta `[GPS] REVISAR: El vehiculo no visito la geocerca de este proyecto.` y se conservan los KMs y Tiempos acumulados de la unidad.

---

## 🔀 CASO 6 — Múltiples Proyectos Normales, Misma Unidad

### Métodos de Corte (en orden de prioridad)

**Corte A — Retorno a Oficina SMARTCORP:**
El vehículo vuelve al patio entre proyectos.
- Corte = hora de llegada a oficina, redondeada al siguiente cuarto de hora.

**Corte B — Traslado Directo (Midpoint):**
El vehículo viajó directamente de Obra A a Obra B.
- `t_dep` = hora de salida de geocerca del Proyecto A.
- `t_arr` = hora de llegada a geocerca del Proyecto B.
- `T_corte = techo((t_dep + t_arr) / 2)` al cuarto de hora.
- La distancia y tiempo del traslado se divide **50% Proyecto A / 50% Proyecto B**.

> *(Corte C eliminado: todos los proyectos normales deben tener geocerca. Si no la tienen, alerta de no-visita.)*

### 🗂️ Ejemplo — Traslado Directo
> `t_dep = 12:30`, `t_arr = 13:15`. Midpoint = 12:52. Redondeado = 13:00.
> **Resultado A:** `DE = 08:00`, `A = 13:00`. **Resultado B:** `DE = 13:00`, `A = 18:00`.

---

## 🔄 CASO 7 — Múltiples Proyectos, Distinta Unidad por Proyecto *(Ya implementado)*

Cada fila de la Bitácora tiene su propia unidad. El sistema procesa cada una con las rutas GPS de ese vehículo específico. KMs y tiempo son completamente independientes por fila.

---

## ↩️ CASO 8 — Regreso al Mismo Proyecto (Columna REGRESOS)

Un regreso = ir al proyecto, volver a SMARTCORP, y regresar al **mismo** proyecto (no a otro).

| Patrón de geocercas del día | `REGRESOS` |
| :--- | :---: |
| SMARTCORP → Proyecto → SMARTCORP | 0 |
| SMARTCORP → Proyecto → SMARTCORP → Proyecto → SMARTCORP | 1 |
| SMARTCORP → Proyecto → SMARTCORP → Proyecto → SMARTCORP → Proyecto → SMARTCORP | 2 |

El tiempo de los viajes de regreso se incluye en `TIEMPO RECORRIDO` (no en paradas).

---

## 🛑 CASO 9 — Paradas (Columnas PARADAS y TIEMPO DE PARADAS)

Las paradas vienen del archivo GPS de Ubiqo (cada tramo ya trae paradas con duración en minutos). El sistema aplica un **filtro de promedio mínimo de 10 minutos por parada**:

**Algoritmo:**
1. Sumar: `total_paradas` y `total_min_paradas` de todo el bloque.
2. `avg_min = total_min_paradas / total_paradas`.
3. Si `avg_min ≤ 10` → `PARADAS = ""`, `TIEMPO DE PARADAS = ""` (ruido de tráfico).
4. Si `avg_min > 10` → `PARADAS = 1`, `TIEMPO DE PARADAS = avg_min` (**el promedio**, no el total).

> ⚠️ **Corrección pendiente en código:** El código actual no aplica este filtro y escribe el conteo real y el tiempo total.

### 🗂️ Ejemplo
> 4 paradas, 35 min total. Promedio: 8.75 min → **`PARADAS = ""`, `TIEMPO DE PARADAS = ""`**.
>
> 3 paradas, 35 min total. Promedio: 11.67 min → **`PARADAS = 1`, `TIEMPO DE PARADAS = 00:11:40`** *(~12 min promedio)*.

---

## 🍕 CASO 10 — Parada de Comida Fuera de la Oficina y Fuera del Proyecto *(Ya Implementado)*

> ✅ **Estatus en el sistema:** **IMPLEMENTADO AL 100%.** Se aplica el filtro general de paradas (`avg > 10 min`), la exención de filas administrativas para detenciones de 45m a 2hr en horario de comida y la detección de Parada Prolongada (>90 min).

El vehículo se detiene en un lugar no registrado durante 45 min – 2 hrs y luego regresa al mismo proyecto.

**Condiciones para clasificarlo como "comida" (sin generar fila nueva):**
1. La Bitácora **no tiene** otro proyecto registrado en ese horario.
2. Duración entre **45 minutos y 2 horas**.
3. Después regresa al proyecto original.

**Si se cumple:** El bloque sigue siendo el mismo proyecto. No se registra en `TIEMPO DE PARADAS` (esa columna es exclusiva para paradas del GPS de Ubiqo).
**Si no se cumple:** Se trata como Caso 13.

---

## 👥 CASO 11 — Dos Técnicos, Misma Unidad, Mismo Día *(Ya Implementado)*

> ✅ **Estatus en el sistema:** **IMPLEMENTADO AL 100%.** Se realiza el filtrado y segmentación independiente de telemetría GPS para cada técnico según las partidas asignadas en Bitácora y la discriminación por turno nocturno (`esNocturno`).

Unidad usada por Técnico A (horario normal) y Técnico B (horario nocturno).
1. Rutas 06:00–18:00 → Técnico A → reglas normales.
2. Rutas 18:00–06:00 → Técnico B → turno fuera de horario.
3. Confirmación de asignación por geocercas vs. proyectos de Bitácora de cada técnico.

---

## 📡 CASO 12 — Pérdida de Señal GPS / Brecha de Coordenadas *(Ya implementado)*

Si hay salto de más de **500 metros** entre tramos, la distancia faltante se suma a los KMs del siguiente tramo.
La proximidad inteligente (1,500m) ayuda a detectar la geocerca aun con brechas de señal.

### ⚠️ Sub-Caso 12B — Falla de Cobertura al Inicio de Ruta (Salida Desplazada)
- **Ámbito exclusivo:** Aplica **ÚNICAMENTE a Proyectos Normales** (los proyectos especiales siguen su regla propia e inamovible de la jerarquía: `DE = 08:00`, `A = 18:00`).
- **Regla:** Si la unidad empieza a registrar GPS fuera de la geocerca de la Oficina SMARTCORP (por retraso o falla del GPS en encendido):
  - **No contaminar HORA DE SALIDA:** Se suprime (vacía) la celda `HORA DE SALIDA`.
  - **Evaluar Inicio Tardío:** Si la primera señal de movimiento es posterior a las 09:00, **sí se genera** la fila administrativa de Inicio Tardío (`SMARTHAUS GASTOS`) de 08:00 a HH:MM.

---

## ⚠️ CASO 13 — Parada Prolongada Desconocida (>90 minutos)

Si el vehículo estuvo parado >90 min en un lugar que no es la oficina ni ningún proyecto registrado, el sistema genera **una fila nueva por cada técnico** que va en esa unidad. Las filas se insertan usando el `adminTracker` para que no queden intercaladas entre los proyectos de cada técnico.

**Lo que escribe cada fila nueva:**
- `PROYECTO`: `"PROYECTO NO REGISTRADO"` (o nombre de geocerca más cercana si existe).
- `ASUNTO`: `"Proyecto instalación"`.
- `DE` y `A`: el horario del bloque (sigue la segmentación del día).
- `REV = "REVISAR"`.
- `OBSERVACIONES`: `[GPS] Fila agregada automáticamente: Permanencia de X minutos en ubicación no registrada.`
- `PARADAS` y `TIEMPO DE PARADAS`: **vacíos** (es fila de proyecto, no de parada).

> ⚠️ **Corrección pendiente en código:** El código actual escribe PARADAS y TIEMPO DE PARADAS en esta fila. Debe quitarlos.

### 🗂️ Ejemplo
> Unidad compartida por Técnico A y Técnico B. El vehículo estuvo 2 horas en colonia desconocida.
> **Resultado:** Se inserta una fila `REVISAR` para el Técnico A y otra para el Técnico B (una por técnico), pero ambas se agrupan usando el adminTracker para no quedar intercaladas con sus proyectos.

---

## 🕐 CASO 14 — Retorno Temprano (antes de las 17:00) *(Ya implementado)*

- `A = 18:00` forzado en el proyecto.
- Se genera/reutiliza fila `SMARTHAUS GASTOS`: `DE = hora real`, `A = 18:00`, `REV = "REVISAR"`.
- `OBSERVACIONES`: `[GPS] Fila administrativa autogenerada por retorno temprano (HH:MM a 18:00)`.
- Las filas `SMARTHAUS GASTOS` se agrupan usando el `adminTracker`.

---

## 🕙 CASO 15 — Inicio Tardío (después de las 09:00) *(Ya implementado)*

- `DE = 08:00` forzado en el proyecto.
- Se genera/reutiliza fila `SMARTHAUS GASTOS`: `DE = 08:00`, `A = hora real de salida`, `REV = "REVISAR"`.
- `OBSERVACIONES`: `[GPS] Fila administrativa autogenerada por inicio tardio (08:00 a HH:MM)`.
- Las filas `SMARTHAUS GASTOS` se agrupan usando el `adminTracker`.

---

## ⏰ CASO 16 — Horas Extra (regresa después de las 19:00) *(Ya implementado)*

- `A = 18:00` forzado.
- `HORAS EXTRA = Hora de arribo real - 18.0` (se dan hasta las 18:00 para tráfico/comida de vuelta).
- `HORA ENTRADA = ""` and `HORA SAL PROY = ""` (Excepción B: no contaminar métricas).

### 🗂️ Ejemplo
> Regresó a las 20:30.
> `A = 18:00` | `HORAS EXTRA = 2.5` | `HORA ENTRADA = ""` | `HORA SAL PROY = ""`.

---

## 🚗 CASO 17 (NUEVO) — Cuadrilla Multi-Unidad y Traspaso/Continuación de Proyecto

Ocurre cuando un técnico o cuadrilla realiza un proyecto en una unidad y posteriormente se incorpora a otra unidad para continuar el mismo proyecto o trasladarse a otro.

**Reglas de Negocio:**
1. **Regresos al Proyecto:** El cambio de unidad para continuar el mismo proyecto **NO cuenta como regreso** (`REGRESOS = ""`).
2. **Corte de Horario:** La jornada se segmenta en el punto medio (midpoint) entre la salida de la primera geocerca de trabajo y la llegada a la siguiente geocerca de trabajo.
3. **Métricas por Fila:** Cada fila conserva únicamente la distancia (`KM`) y duración real recorrida por la unidad asignada a esa fila.

### 🗂️ Ejemplo Práctico (Fecha 20/07/2026):
- **Técnico Fernando:**
  - Unidad 10 (VELOZIT): Sale 09:22 → Fila `SMARTHAUS GASTOS` (08:00 a 09:30).
  - Regresa a oficina 10:20 y se traslada a la Unidad 28 para continuar en `VELOZIT` con Daniela y Jorge.
  - Fila 2 (`VELOZIT`): `DE = 09:30`, `A = 14:30` (corte midpoint entre salida VELOZIT 13:42 y llegada EL MILAGRO 15:16).
  - Fila 3 (`EL MILAGRO`): `DE = 14:30`, `A = 18:00`.
- **Técnicos Daniela y Jorge:**
  - Unidad 28 (VELOZIT + EL MILAGRO): Fila `SMARTHAUS GASTOS` (08:00 a 10:45).
  - Fila 2 (`VELOZIT`): `DE = 10:45`, `A = 14:30`.
  - Fila 3 (`EL MILAGRO`): `DE = 14:30`, `A = 18:00`.

---

## 📊 REFERENCIA RÁPIDA — Columnas por Proyecto

| Col | Nombre | Aplica en |
| :---: | :--- | :--- |
| G | `DE` | Todos |
| H | `A` | Todos |
| O | `REV` | Todos (cuando hay alerta) |
| P | `HORA DE SALIDA` | Solo: **Primero o Único del día + Normal** (sin Excepción A) |
| Q | `HORA DE ENTRADA` | Solo: **Último o Único del día + Normal** (sin Excepción B) |
| R | `TIEMPO RECORRIDO` | Todos con GPS (vacío en nocturno y especial sin GPS) |
| S | `TIEMPO DE PARADAS` | Solo Normal; cuando avg parada > 10 min; valor = **promedio** de minutos |
| T | `PARADAS` | Solo Normal; cuando avg parada > 10 min; valor siempre = `1` |
| U | `REGRESOS` | Solo Normal; cuando hay regresos al mismo proyecto |
| V | `OBSERVACIONES` | Todos (cuando hay alerta) |
| W | `KM` | Todos con GPS (vacío en nocturno y especial sin GPS) |
| X | `HORAS EXTRA` | Solo Normal; cuando regresa después de las 19:00 |
| Y | `HORA SAL PROY` | Solo: **Único del día + Normal** (sin Excepción B) |
| Z | `HORA LLEG PROY` | Solo: **Primero o Único del día + Normal** (sin Excepción A) |

---

## 🔴 ESTADO DE REGLAS DE NEGOCIO Y MEJORAS

| # | Descripción | Impacto | Estado |
| :---: | :--- | :---: | :---: |
| **1** | Módulo de Auditoría de Reportes Enviados (`REPORTE ENV.`) con clasificación `SI`, `FT`, `NO`, `NA` | Alto | ✅ Implementado (v4.4) |
| **2** | Alineación de límites en cambio de unidad (Caso Velozit) usando geocercas en cuadrilla | Alto | ✅ Implementado (v4.4) |
| **3** | Horario por defecto 08:00 a 18:00 para partidas con `UNIDAD = NA` | Medio | ✅ Implementado (v4.4) |
| **4** | Protecciones para filas administrativas (evitar crash por lectura de `routes.length`) | Alto | ✅ Implementado (v4.4) |
| **5** | Corrección de detención de la búsqueda de oficina cuando hay otros proyectos activos | Medio | ✅ Implementado (v4.4) |
| **6** | Umbral fuera de horario (Turno Nocturno): `esNocturno` ajustado a `≥18:00` y `<06:00` | Alto | ✅ Implementado (v4.4) |
| **7** | Filtro de paradas: filtro avg >10 min (`PARADAS = 1`, `TIEMPO PARADAS = avg`) | Medio | ✅ Implementado (v4.4) |
| **8** | CASO 10 — Parada de comida fuera de geocerca (45m–2hr) preserva proyecto sin alerta inválida | Medio | ✅ Implementado (v4.4) |
| **9** | CASO 11 — Dos técnicos en misma unidad con filtrado independiente de telemetría por proyecto | Alto | ✅ Implementado (v4.4) |

---

## 💬 ESPACIO PARA CORRECCIONES Y NUEVOS CASOS

*(Escribe aquí cualquier ajuste antes de que se implemente en el código. Este documento se actualiza cada vez que se aprueba un cambio.)*
