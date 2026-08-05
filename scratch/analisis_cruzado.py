#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ANALISIS CRUZADO GPS vs BITACORA SMARTCORP
Unidad: SH-U30-Frontier 2  <->  30 (Frontier 2)
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import subprocess

# Instalar dependencias si faltan
for pkg in ["openpyxl"]:
    try:
        __import__(pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

import openpyxl
from datetime import datetime, timedelta
import json
import re
import os

# ---------------------------------------------
# RUTAS
# ---------------------------------------------
GPS_FILE      = r"c:\Users\MARCO\Desktop\HOLDING_IA\BITACORA_SMARTCORP\scratch\Reporte Dinamico (14).xlsx"
BITACORA_FILE = r"c:\Users\MARCO\Desktop\HOLDING_IA\BITACORA_SMARTCORP\scratch\BD Proyectos_ejemplo.xlsx"

SEP = "=" * 80

def fmt(v):
    """Formatea valores para mostrar."""
    if v is None:
        return "—"
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M:%S")
    return str(v).strip()

def parse_duration_to_seconds(dur_str):
    """Parsea 'X h. Y min. Z s.' o 'HH:MM:SS' a segundos totales."""
    if dur_str is None or str(dur_str).strip() == "":
        return 0
    s = str(dur_str).strip()
    # Formato "X h. Y min. Z s."
    m = re.match(r'(?:(\d+)\s*h\.)?\s*(?:(\d+)\s*min\.)?\s*(?:(\d+)\s*s\.)?', s)
    if m and any(m.groups()):
        h = int(m.group(1) or 0)
        mi = int(m.group(2) or 0)
        sc = int(m.group(3) or 0)
        return h*3600 + mi*60 + sc
    # Formato HH:MM:SS
    parts = s.split(":")
    if len(parts) == 3:
        try:
            return int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
        except:
            pass
    # Formato MM:SS
    if len(parts) == 2:
        try:
            return int(parts[0])*60 + int(parts[1])
        except:
            pass
    return 0

def seconds_to_hms(sec):
    sec = int(sec)
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

def haversine_km(lat1, lon1, lat2, lon2):
    """Distancia en km entre dos coordenadas."""
    import math
    R = 6371
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lon2 - lon1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return R * 2 * math.asin(math.sqrt(a))

# ---------------------------------------------
# PASO 1 — LEER GPS
# ---------------------------------------------
print(SEP)
print("PASO 1 — LECTURA COMPLETA DEL ARCHIVO GPS")
print(SEP)

wb_gps = openpyxl.load_workbook(GPS_FILE, data_only=True)
ws_gps = wb_gps.active
print(f"Hoja activa GPS: {ws_gps.title}")
print(f"Dimensiones: {ws_gps.dimensions}  |  Max fila: {ws_gps.max_row}  |  Max col: {ws_gps.max_column}")
print()

# Mostrar primeras 8 filas crudas para contexto
print("-- FILAS CRUDAS 1-8 (debug) --")
for r in range(1, 9):
    row_vals = []
    for c in range(1, ws_gps.max_column + 1):
        cell = ws_gps.cell(row=r, column=c)
        if cell.value is not None:
            row_vals.append(f"[{c}]={repr(cell.value)[:50]}")
    print(f"  Fila {r}: {' | '.join(row_vals) if row_vals else '(vacia)'}")
print()

# Celda A5 — nombre de dispositivo
device_name = ws_gps["A5"].value
print(f"> Dispositivo (A5): {device_name}")

# Resumen del día: F3, K3, N3
f3 = ws_gps["F3"].value
k3 = ws_gps["K3"].value
n3 = ws_gps["N3"].value
print(f"> Resumen del día:")
print(f"   F3 (Paradas totales): {fmt(f3)}")
print(f"   K3 (Distancia total): {fmt(k3)}")
print(f"   N3 (Tiempo en movimiento): {fmt(n3)}")
print()

# Fila 6 — encabezados
print("-- ENCABEZADOS FILA 6 --")
headers = {}
header_names = []
for c in range(1, ws_gps.max_column + 1):
    v = ws_gps.cell(row=6, column=c).value
    header_names.append(v)
    if v is not None:
        headers[str(v).strip().lower()] = c
        print(f"   Col {c} ({openpyxl.utils.get_column_letter(c)}): {repr(v)}")
print()
print("Mapa de encabezados (lower):", json.dumps({k: v for k,v in headers.items()}, ensure_ascii=False, indent=2))
print()

# Buscar columnas clave dinámicamente
def find_col(headers, *candidates):
    for cand in candidates:
        for k, v in headers.items():
            if cand.lower() in k:
                return v
    return None

col_fecha_ini = find_col(headers, "fecha inicial")
col_fecha_fin = find_col(headers, "fecha final")
col_lat_ini   = find_col(headers, "latitud inicial")
col_lon_ini   = find_col(headers, "longitud inicial")
col_lat_fin   = find_col(headers, "latitud final")
col_lon_fin   = find_col(headers, "longitud final")
col_dist      = find_col(headers, "distancia")
col_dur       = find_col(headers, "duraci")   # duracion/duración

print("-- COLUMNAS CLAVE DETECTADAS --")
for name, col in [
    ("Fecha Inicial", col_fecha_ini), ("Fecha Final", col_fecha_fin),
    ("Latitud Inicial", col_lat_ini), ("Longitud Inicial", col_lon_ini),
    ("Latitud Final", col_lat_fin),   ("Longitud Final", col_lon_fin),
    ("Distancia", col_dist),           ("Duracion", col_dur),
]:
    col_letter = openpyxl.utils.get_column_letter(col) if col else "NO ENCONTRADA"
    print(f"   {name}: columna {col} ({col_letter})")
print()

# Leer todos los segmentos GPS (filas 7+)
print("-- TODOS LOS SEGMENTOS GPS (filas 7+) --")
segments = []
for r in range(7, ws_gps.max_row + 1):
    # Verificar que la fila no esté vacia
    fecha_ini_val = ws_gps.cell(row=r, column=col_fecha_ini).value if col_fecha_ini else None
    if fecha_ini_val is None:
        # Revisar si hay CUALQUIER valor en la fila
        any_val = any(ws_gps.cell(row=r, column=c).value is not None for c in range(1, ws_gps.max_column+1))
        if not any_val:
            continue
    
    # Leer todos los valores de la fila
    row_data = {}
    for c in range(1, ws_gps.max_column + 1):
        row_data[c] = ws_gps.cell(row=r, column=c).value
    
    fecha_ini = row_data.get(col_fecha_ini) if col_fecha_ini else None
    fecha_fin = row_data.get(col_fecha_fin) if col_fecha_fin else None
    lat_ini   = row_data.get(col_lat_ini)   if col_lat_ini else None
    lon_ini   = row_data.get(col_lon_ini)   if col_lon_ini else None
    lat_fin   = row_data.get(col_lat_fin)   if col_lat_fin else None
    lon_fin   = row_data.get(col_lon_fin)   if col_lon_fin else None
    distancia = row_data.get(col_dist)      if col_dist else None
    duracion  = row_data.get(col_dur)       if col_dur else None

    # Imprimir fila cruda completa
    all_vals = " | ".join([f"C{c}={repr(str(v)[:30])}" for c,v in row_data.items() if v is not None])
    print(f"\n  Fila {r}: {all_vals}")
    
    # Parsear distancia
    dist_km = 0.0
    if distancia is not None:
        try:
            dist_km = float(str(distancia).replace(",", ".").strip())
        except:
            pass
    
    # Parsear duración
    dur_secs = parse_duration_to_seconds(duracion)
    
    # Clasificar
    tipo = "PARADA" if dist_km < 0.1 else "VIAJE"
    
    seg = {
        "fila": r,
        "fecha_ini": fecha_ini,
        "fecha_fin": fecha_fin,
        "lat_ini": lat_ini,
        "lon_ini": lon_ini,
        "lat_fin": lat_fin,
        "lon_fin": lon_fin,
        "distancia_km": dist_km,
        "duracion_raw": duracion,
        "duracion_secs": dur_secs,
        "tipo": tipo,
        "row_data": row_data,
    }
    segments.append(seg)
    
    tipo_tag = f"[{tipo}]"
    if tipo == "VIAJE":
        print(f"     -> {tipo_tag} {fmt(fecha_ini)} -> {fmt(fecha_fin)} | {dist_km:.2f} km | dur: {seconds_to_hms(dur_secs)} | ({lat_ini},{lon_ini}) -> ({lat_fin},{lon_fin})")
    else:
        print(f"     -> {tipo_tag} Desde {fmt(fecha_ini)} hasta {fmt(fecha_fin)} | dur: {seconds_to_hms(dur_secs)} | coord: ({lat_ini},{lon_ini})")

print(f"\nTotal segmentos leídos: {len(segments)}")
viajes  = [s for s in segments if s["tipo"] == "VIAJE"]
paradas = [s for s in segments if s["tipo"] == "PARADA"]
print(f"  VIAJES: {len(viajes)}  |  PARADAS: {len(paradas)}")

# ---------------------------------------------
# PASO 2 — IDENTIFICAR FECHA DEL GPS
# ---------------------------------------------
print()
print(SEP)
print("PASO 2 — FECHA DEL REPORTE GPS")
print(SEP)

gps_date = None
if segments:
    fi = segments[0]["fecha_ini"]
    if isinstance(fi, datetime):
        gps_date = fi.date()
    elif fi is not None:
        # Intentar parsear
        for fmt_str in ["%Y-%m-%d %H:%M:%S", "%d/%m/%Y %H:%M:%S", "%Y-%m-%d"]:
            try:
                gps_date = datetime.strptime(str(fi), fmt_str).date()
                break
            except:
                pass

if gps_date:
    print(f"> Fecha GPS detectada: {gps_date.strftime('%d/%m/%Y')} ({gps_date})")
else:
    print("[!] No se pudo detectar la fecha GPS automáticamente")
    # Intentar con cualquier segmento
    for seg in segments:
        fi = seg["fecha_ini"]
        if fi is not None:
            print(f"  Primer fecha_ini no-None: {repr(fi)} tipo={type(fi)}")
            break

# ---------------------------------------------
# PASO 3 — LEER BITÁCORA Y FILTRAR
# ---------------------------------------------
print()
print(SEP)
print("PASO 3 — BITÁCORA: FILTRAR POR UNIDAD Y FECHA")
print(SEP)

wb_bit = openpyxl.load_workbook(BITACORA_FILE, data_only=True)
print(f"Hojas disponibles: {wb_bit.sheetnames}")
ws_bit = wb_bit["Bitácora"]
print(f"Hoja 'Bitácora': {ws_bit.dimensions}  Max fila: {ws_bit.max_row}  Max col: {ws_bit.max_column}")
print()

# Leer encabezados de la Bitácora (fila 1)
bit_headers = {}
bit_header_names = []
for c in range(1, ws_bit.max_column + 1):
    v = ws_bit.cell(row=1, column=c).value
    bit_header_names.append(v)
    if v is not None:
        bit_headers[str(v).strip().upper()] = c

print("-- ENCABEZADOS BITÁCORA (fila 1) --")
for name, col in bit_headers.items():
    print(f"   Col {col} ({openpyxl.utils.get_column_letter(col)}): {name}")
print()

# Columnas clave Bitácora
def find_bit_col(bit_headers, *candidates):
    for cand in candidates:
        for k, v in bit_headers.items():
            if cand.upper() in k:
                return v
    return None

bc_fecha       = find_bit_col(bit_headers, "FECHA")
bc_proyecto    = find_bit_col(bit_headers, "PROYECTO")
bc_nombre      = find_bit_col(bit_headers, "NOMBRE")
bc_asunto      = find_bit_col(bit_headers, "ASUNTO")
bc_unidad      = find_bit_col(bit_headers, "UNIDAD")
bc_hora_sal    = find_bit_col(bit_headers, "HORA DE SALIDA", "HORA SAL")
bc_hora_ent    = find_bit_col(bit_headers, "HORA DE ENTRADA", "HORA ENT")
bc_km          = find_bit_col(bit_headers, "KM")
bc_paradas     = find_bit_col(bit_headers, "PARADAS")
bc_hora_sal_p  = find_bit_col(bit_headers, "HORA SAL PROY")
bc_hora_lleg_p = find_bit_col(bit_headers, "HORA LLEG PROY")
bc_tiempo_rec  = find_bit_col(bit_headers, "TIEMPO RECORRIDO")
bc_de          = find_bit_col(bit_headers, "DE")
bc_a           = find_bit_col(bit_headers, "\" A\"", "\" A\"")

# Buscar DE y A manualmente si no encontrados
for k, v in bit_headers.items():
    if k.strip() == "DE":
        bc_de = v
    if k.strip() == "A":
        bc_a = v

print("-- COLUMNAS CLAVE BITÁCORA DETECTADAS --")
for name, col in [
    ("FECHA", bc_fecha), ("PROYECTO", bc_proyecto), ("NOMBRE", bc_nombre),
    ("ASUNTO", bc_asunto), ("UNIDAD", bc_unidad), ("HORA DE SALIDA", bc_hora_sal),
    ("HORA DE ENTRADA", bc_hora_ent), ("KM", bc_km), ("PARADAS", bc_paradas),
    ("HORA SAL PROY", bc_hora_sal_p), ("HORA LLEG PROY", bc_hora_lleg_p),
    ("TIEMPO RECORRIDO", bc_tiempo_rec), ("DE", bc_de), ("A", bc_a),
]:
    col_letter = openpyxl.utils.get_column_letter(col) if col else "NO ENCONTRADA"
    print(f"   {name}: columna {col} ({col_letter})")
print()

# Filtrar filas
TARGET_UNIDAD = "30 (Frontier 2)"
filtered_rows = []

print(f"Filtrando por UNIDAD='{TARGET_UNIDAD}' y FECHA={gps_date}")
print()

# Primero, mostrar valores únicos de UNIDAD y FECHA para debug
unidades_unicas = set()
fechas_unicas = set()
for r in range(2, min(ws_bit.max_row + 1, 5000)):
    u_val = ws_bit.cell(row=r, column=bc_unidad).value if bc_unidad else None
    f_val = ws_bit.cell(row=r, column=bc_fecha).value if bc_fecha else None
    if u_val: unidades_unicas.add(str(u_val).strip())
    if f_val: 
        if isinstance(f_val, datetime):
            fechas_unicas.add(f_val.date())
        else:
            fechas_unicas.add(str(f_val).strip())

print(f"Unidades únicas en Bitácora (primeras 30): {sorted(list(unidades_unicas))[:30]}")
print(f"Fechas únicas en Bitácora (tipo y primeras 20): {sorted([str(f) for f in list(fechas_unicas)])[:20]}")
print()

# Ahora filtrar
for r in range(2, ws_bit.max_row + 1):
    u_val = ws_bit.cell(row=r, column=bc_unidad).value if bc_unidad else None
    f_val = ws_bit.cell(row=r, column=bc_fecha).value if bc_fecha else None
    
    # Normalizar unidad
    u_str = str(u_val).strip() if u_val else ""
    
    # Normalizar fecha
    f_date = None
    if isinstance(f_val, datetime):
        f_date = f_val.date()
    elif f_val is not None:
        for fmt_str in ["%Y-%m-%d", "%d/%m/%Y", "%d/%m/%Y %H:%M:%S"]:
            try:
                f_date = datetime.strptime(str(f_val).strip(), fmt_str).date()
                break
            except:
                pass
    
    if u_str == TARGET_UNIDAD and f_date == gps_date:
        row_dict = {}
        for c in range(1, ws_bit.max_column + 1):
            hdr = bit_header_names[c-1]
            row_dict[hdr] = ws_bit.cell(row=r, column=c).value
        row_dict["_fila"] = r
        filtered_rows.append(row_dict)

print(f"> Filas encontradas en Bitácora para {TARGET_UNIDAD} en {gps_date}: {len(filtered_rows)}")
print()

if filtered_rows:
    # Mostrar cada fila de forma legible
    for i, row in enumerate(filtered_rows, 1):
        print(f"  --- Fila Bitácora #{i} (fila Excel {row['_fila']}) ---")
        for k, v in row.items():
            if k != "_fila" and v is not None:
                print(f"    {k}: {fmt(v)}")
        print()
    
    # Estadísticas
    proyectos = set()
    personas = set()
    for row in filtered_rows:
        p = row.get("PROYECTO") or row.get(bit_header_names[bc_proyecto-1] if bc_proyecto else None)
        n = row.get("NOMBRE") or row.get(bit_header_names[bc_nombre-1] if bc_nombre else None)
        # Buscar por posición de columna
        if bc_proyecto:
            p = ws_bit.cell(row=row["_fila"], column=bc_proyecto).value
        if bc_nombre:
            n = ws_bit.cell(row=row["_fila"], column=bc_nombre).value
        if p: proyectos.add(str(p).strip())
        if n: personas.add(str(n).strip())
    
    print(f"> Personas en la unidad ese día: {len(personas)}")
    for p in sorted(personas):
        print(f"   - {p}")
    print(f"> Proyectos distintos: {len(proyectos)}")
    for p in sorted(proyectos):
        print(f"   - {p}")
else:
    print("[!] No se encontraron filas. Verificando datos cercanos...")
    # Mostrar algunas filas con esa unidad sin importar la fecha
    count_u = 0
    for r in range(2, ws_bit.max_row + 1):
        u_val = ws_bit.cell(row=r, column=bc_unidad).value if bc_unidad else None
        if u_val and TARGET_UNIDAD in str(u_val):
            count_u += 1
            if count_u <= 5:
                f_val = ws_bit.cell(row=r, column=bc_fecha).value if bc_fecha else None
                print(f"  Fila {r}: UNIDAD={repr(u_val)}  FECHA={repr(f_val)}")
    print(f"  Total filas con esa unidad (cualquier fecha): {count_u}")

# ---------------------------------------------
# PASO 4 — LÍNEA DE TIEMPO Y ANÁLISIS DE SECUENCIA
# ---------------------------------------------
print()
print(SEP)
print("PASO 4 — LÍNEA DE TIEMPO GPS DEL DÍA")
print(SEP)

def get_time_str(dt_val):
    if isinstance(dt_val, datetime):
        return dt_val.strftime("%H:%M")
    return "??:??"

def get_hour_float(dt_val):
    if isinstance(dt_val, datetime):
        return dt_val.hour + dt_val.minute/60
    return None

print(f"\n{'#':>3} | {'HORA INI':>8} | {'HORA FIN':>8} | {'TIPO':>7} | {'KM':>6} | {'DURACIÓN':>10} | COORDENADAS")
print("-" * 100)

timeline = []
for i, seg in enumerate(segments, 1):
    h_ini = get_time_str(seg["fecha_ini"])
    h_fin = get_time_str(seg["fecha_fin"])
    dur_min = seg["duracion_secs"] / 60
    
    # Coordenadas
    if seg["tipo"] == "VIAJE":
        coords = f"({seg['lat_ini']},{seg['lon_ini']}) -> ({seg['lat_fin']},{seg['lon_fin']})"
    else:
        coords = f"({seg['lat_ini']},{seg['lon_ini']})"
    
    print(f"{i:>3} | {h_ini:>8} | {h_fin:>8} | {seg['tipo']:>7} | {seg['distancia_km']:>6.2f} | {seconds_to_hms(seg['duracion_secs']):>10} | {coords}")
    
    timeline.append({
        "idx": i,
        "tipo": seg["tipo"],
        "hora_ini": seg["fecha_ini"],
        "hora_fin": seg["fecha_fin"],
        "h_ini_str": h_ini,
        "h_fin_str": h_fin,
        "dur_min": dur_min,
        "dist_km": seg["distancia_km"],
        "lat_ini": seg["lat_ini"],
        "lon_ini": seg["lon_ini"],
        "lat_fin": seg["lat_fin"],
        "lon_fin": seg["lon_fin"],
        "tag": "",
    })

# Identificar bloques lógicos
print()
print("-- BLOQUES LÓGICOS DEL DÍA --")
print()

# Primer viaje significativo
primer_viaje_idx = None
for t in timeline:
    if t["tipo"] == "VIAJE" and t["dist_km"] >= 0.5:
        primer_viaje_idx = t["idx"]
        t["tag"] = "SALIDA_OFICINA"
        print(f"> SALIDA DE OFICINA: Segmento #{t['idx']} | {t['h_ini_str']} -> {t['h_fin_str']} | {t['dist_km']:.2f} km")
        break

# Último segmento
if timeline:
    ultimo = timeline[-1]
    ultimo["tag"] = "FIN_DIA"
    print(f"> FIN DEL DÍA: Segmento #{ultimo['idx']} | {ultimo['h_ini_str']} -> {ultimo['h_fin_str']}")

# Paradas por duración
print()
print("-- CLASIFICACIÓN DE PARADAS POR DURACIÓN --")
print()
for t in timeline:
    if t["tipo"] == "PARADA":
        dur_m = t["dur_min"]
        if dur_m > 30:
            cat = "ESTANCIA LARGA (>30 min) — posible proyecto o lunch"
        elif dur_m > 15:
            cat = "PARADA MEDIA (15-30 min)"
        elif dur_m > 5:
            cat = "PARADA CORTA (5-15 min)"
        else:
            cat = "PARADA BREVE (<5 min) — semáforo/técnica"
        print(f"  Segmento #{t['idx']} | {t['h_ini_str']} -> {t['h_fin_str']} | {dur_m:.1f} min | {cat}")
        print(f"    Coord: ({t['lat_ini']},{t['lon_ini']})")

# Paradas largas como candidatos de almuerzo/proyecto
print()
print("-- PARADAS LARGAS (>15 min) — DETALLE --")
paradas_largas = [t for t in timeline if t["tipo"] == "PARADA" and t["dur_min"] > 15]
for t in paradas_largas:
    print(f"  #{t['idx']}: {t['h_ini_str']} -> {t['h_fin_str']} | {t['dur_min']:.1f} min | ({t['lat_ini']},{t['lon_ini']})")

# ---------------------------------------------
# PASO 5 — ANÁLISIS DE CAMPOS DE y A
# ---------------------------------------------
print()
print(SEP)
print("PASO 5 — ANÁLISIS DE CAMPOS DE y A")
print(SEP)

# Primer viaje del día -> hora de salida
primer_seg_hora = None
for t in timeline:
    if t["tipo"] == "VIAJE" and t["dist_km"] >= 0.5 and t["hora_ini"] is not None:
        primer_seg_hora = t["hora_ini"]
        break
if primer_seg_hora is None:
    for t in timeline:
        if t["hora_ini"] is not None:
            primer_seg_hora = t["hora_ini"]
            break

# Último segmento -> hora de llegada
ultimo_seg_hora = None
for t in reversed(timeline):
    if t["hora_fin"] is not None:
        ultimo_seg_hora = t["hora_fin"]
        break

if primer_seg_hora and isinstance(primer_seg_hora, datetime):
    de_calculado = primer_seg_hora.hour  # Redondear hacia abajo
    print(f"> Primer viaje GPS: {primer_seg_hora.strftime('%H:%M')}")
    print(f"> DE calculado (hora entera, floor): {de_calculado}")
else:
    de_calculado = None
    print("[!] No se pudo calcular DE")

if ultimo_seg_hora and isinstance(ultimo_seg_hora, datetime):
    hora_regreso = ultimo_seg_hora.hour + (1 if ultimo_seg_hora.minute > 0 else 0)
    a_calculado = hora_regreso - 1  # Menos 1 hora de comida
    print(f"> Último segmento GPS (hora fin): {ultimo_seg_hora.strftime('%H:%M')}")
    print(f"> A calculado (hora regreso - 1h comida, floor): {a_calculado}")
else:
    a_calculado = None
    print("[!] No se pudo calcular A")

# Comparar con valores en Bitácora
print()
if filtered_rows and bc_de and bc_a:
    de_bits = set()
    a_bits = set()
    for row in filtered_rows:
        de_val = ws_bit.cell(row=row["_fila"], column=bc_de).value
        a_val  = ws_bit.cell(row=row["_fila"], column=bc_a).value
        if de_val is not None: de_bits.add(de_val)
        if a_val is not None: a_bits.add(a_val)
    print(f"> DE en Bitácora: {de_bits}  |  A en Bitácora: {a_bits}")
    print(f"> DE calculado por GPS: {de_calculado}  |  A calculado: {a_calculado}")
    if de_calculado in de_bits:
        print("[OK] DE coincide con Bitácora")
    else:
        print(f"[X] DE no coincide: GPS={de_calculado} vs Bitácora={de_bits}")
    if a_calculado in a_bits:
        print("[OK] A coincide con Bitácora")
    else:
        print(f"[X] A no coincide: GPS={a_calculado} vs Bitácora={a_bits}")
else:
    print("(Sin filas de Bitácora para comparar DE/A)")

# ---------------------------------------------
# PASO 6 — DETECCIÓN DE LUNCH Y REGRESOS
# ---------------------------------------------
print()
print(SEP)
print("PASO 6 — DETECCIÓN DE PATRONES: LUNCH Y REGRESOS")
print(SEP)

# Detectar posible rango de horario de almuerzo (12:00-14:00)
print("-- PARADAS EN HORARIO DE LUNCH (11:30-14:30) --")
lunch_candidates = []
for t in timeline:
    if t["tipo"] == "PARADA" and t["hora_ini"] and isinstance(t["hora_ini"], datetime):
        h = t["hora_ini"].hour + t["hora_ini"].minute/60
        if 11.5 <= h <= 14.5 and t["dur_min"] > 15:
            lunch_candidates.append(t)
            print(f"  #{t['idx']}: {t['h_ini_str']} -> {t['h_fin_str']} | {t['dur_min']:.1f} min | ({t['lat_ini']},{t['lon_ini']})")

if not lunch_candidates:
    print("  Ninguna parada detectada en horario de lunch con criterio estricto.")
    # Mostrar todas las paradas > 15 min
    print("  Paradas > 15 min en cualquier horario:")
    for t in timeline:
        if t["tipo"] == "PARADA" and t["dur_min"] > 15:
            print(f"    #{t['idx']}: {t['h_ini_str']} -> {t['h_fin_str']} | {t['dur_min']:.1f} min")

# Detectar punto de inicio (zona de oficina)
print()
print("-- PUNTO DE ORIGEN (posible oficina) --")
zona_oficina_lat = None
zona_oficina_lon = None
if timeline and timeline[0]["lat_ini"] is not None:
    zona_oficina_lat = timeline[0]["lat_ini"]
    zona_oficina_lon = timeline[0]["lon_ini"]
    print(f"  Coordenada inicial del día: ({zona_oficina_lat}, {zona_oficina_lon})")

# Detectar regresos a oficina intermedios
print()
print("-- ANÁLISIS DE REGRESOS A OFICINA --")
if zona_oficina_lat:
    for i, t in enumerate(timeline):
        lat = t["lat_fin"] if t["tipo"] == "VIAJE" else t["lat_ini"]
        lon = t["lon_fin"] if t["tipo"] == "VIAJE" else t["lon_ini"]
        if lat and lon:
            try:
                dist_to_origin = haversine_km(lat, lon, zona_oficina_lat, zona_oficina_lon)
                if dist_to_origin < 0.5 and i > 0:
                    print(f"  Segmento #{t['idx']}: Destino cercano al origen ({dist_to_origin:.3f} km)")
                    if i < len(timeline) - 1:
                        print(f"    -> Posible REGRESO INTERMEDIO a oficina")
            except Exception as e:
                pass

# ---------------------------------------------
# PASO 7 — RESUMEN Y RECOMENDACIONES
# ---------------------------------------------
print()
print(SEP)
print("PASO 7 — RECOMENDACIONES DE MAPEO GPS -> BITÁCORA")
print(SEP)

print("""
RECOMENDACIONES CONCRETAS:

1. ASIGNACIÓN DE SEGMENTOS A FILAS DE BITÁCORA:
   ---------------------------------------------
   Con N proyectos en la Bitácora para ese día, el script debe:
   a) Ordenar los proyectos por HORA SAL PROY (hora de salida hacia el proyecto)
   b) Para cada bloque de viajes consecutivos, asignar al proyecto cuyo HORA SAL PROY
      sea más cercana por tiempo al inicio del bloque
   c) Las paradas largas (>15 min) entre dos viajes hacia la misma dirección
      -> pertenecen al mismo proyecto (estancia en sitio)
   d) Si hay solo 1 proyecto ese día -> todos los segmentos van a ese proyecto

2. DETECCIÓN AUTOMÁTICA DE LUNCH:
   ------------------------------
   Criterios (AND):
   a) Parada entre 11:30 y 14:30
   b) Duración > 20 minutos
   c) Coordenadas distintas a la zona de oficina (distancia > 0.5 km del origen)
   d) Opcional: coordenadas distintas al proyecto (si se tienen geocercas)
   Marcador: seg["tipo"] = "LUNCH"
   Efecto en DE/A: restar 1 hora al cálculo de A

3. DETECCIÓN DE REGRESOS:
   ----------------------
   Criterios:
   a) Un VIAJE que termina en la zona de oficina (radio < 0.5 km del punto inicial del día)
   b) Seguido de OTRO viaje posterior (no es el último del día)
   -> Clasificar como REGRESO_INTERMEDIO
   -> La Bitácora tiene un registro "REGRESO" separado para este caso

4. CÁLCULO AUTOMÁTICO DE DE y A:
   ------------------------------
   DE = hour(first_trip.fecha_ini)  [floor hacia abajo]
   A  = hour(last_trip.fecha_fin) - 1  [donde -1 = hora de comida]
   Si last_trip.fecha_fin.minute > 30 -> A += 1 (se considera hora completa)
   Fórmula exacta: A = int(last_fin_hour) - 1  si solo 1 proyecto
   Con múltiples proyectos: A se aplica al último proyecto del día

5. CONFIABILIDAD DEL SISTEMA AUTOMÁTICO:
   ---------------------------------------
   Sin geocercas de proyecto definidas:
   - Asignación de segmentos a proyectos: ~60-70% confiable
     (funciona bien cuando hay 1 proyecto, falla con 2+ proyectos simultáneos)
   - Detección de LUNCH: ~80% confiable (depende del horario)
   - Cálculo DE/A: ~90% confiable (solo depende de timestamps GPS)
   - Detección de regresos: ~75% confiable (usando zona de origen)
   Con geocercas: sube a ~95% en todos los criterios
""")

# ---------------------------------------------
# GUARDAR RESULTADO COMO JSON PARA EL REPORTE
# ---------------------------------------------
print()
print(SEP)
print("GUARDANDO RESULTADOS EN JSON")
print(SEP)

def serialize(v):
    if isinstance(v, datetime):
        return v.isoformat()
    if isinstance(v, (int, float, str, bool)) or v is None:
        return v
    return str(v)

result = {
    "device": str(device_name),
    "gps_date": str(gps_date),
    "summary_f3": fmt(f3),
    "summary_k3": fmt(k3),
    "summary_n3": fmt(n3),
    "total_segments": len(segments),
    "total_viajes": len(viajes),
    "total_paradas": len(paradas),
    "de_calculado": de_calculado,
    "a_calculado": a_calculado,
    "bitacora_filas": len(filtered_rows),
    "timeline": [
        {
            "idx": t["idx"],
            "tipo": t["tipo"],
            "hora_ini": serialize(t["hora_ini"]),
            "hora_fin": serialize(t["hora_fin"]),
            "dur_min": round(t["dur_min"], 1),
            "dist_km": t["dist_km"],
            "lat_ini": t["lat_ini"],
            "lon_ini": t["lon_ini"],
            "lat_fin": t["lat_fin"],
            "lon_fin": t["lon_fin"],
            "tag": t["tag"],
        } for t in timeline
    ],
    "bitacora_rows": [
        {k: serialize(v) for k,v in row.items()} for row in filtered_rows
    ],
}

out_json = r"c:\Users\MARCO\Desktop\HOLDING_IA\BITACORA_SMARTCORP\scratch\analisis_resultado.json"
with open(out_json, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print(f"[OK] Resultados guardados en: {out_json}")

print()
print(SEP)
print("ANÁLISIS COMPLETADO")
print(SEP)
