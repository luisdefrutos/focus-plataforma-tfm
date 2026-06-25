import pandas as pd
import glob
import os
import warnings

# ==============================================================================
# ⚙️ CONFIGURACIÓN
# ==============================================================================
RUTA_CARPETA = r"C:\Users\gil-an\Desktop\Business Analytics LOCAL\CONTACTOS CRM"
ARCHIVO_SALIDA = "CONTACTOS_CRM.xlsx"

PATRON_135 = "clientesTotales0135.xls*"
PATRON_158 = "clientesTotales0158.xls*"

# LISTA FINAL DE COLUMNAS (La estructura limpia que queremos)
COLUMNAS_FINALES = [
    'CUSTOMER CODE', 
    'CUSTOMER CODE 2', 
    'CUSTOMER POSTAL CODE', 
    'CONTACT E-MAIL', 
    'Email-Validacion',       # <--- La nueva protagonista
    'CUSTOMER NAME COMPLETE', 
    'ENTITY'
]

# ==============================================================================
# 🗺️ MAPEOS (Diccionarios de traducción)
# ==============================================================================

# COLUMNAS COMUNES (Iguales en ambos archivos)
MAPEO_COMUN = {
    'ZTUEV_CONTACT_PERSON_STRUC-KUNNR':        'CUSTOMER CODE',
    'BAPIBUS1006_ADDRESS-POSTL_COD1':          'CUSTOMER POSTAL CODE',
    'ZTUEV_CONTACT_PERSON_STRUC-SMTP_ADDRESS': 'CONTACT E-MAIL',
    'BAPIBUS1006_CENTRAL_PERSON-FULLNAME':     'CUSTOMER NAME COMPLETE',
    'Email-Validacion':                        'Email-Validacion' # Se queda igual
}

# MAPEO ESPECÍFICO PARA EL 158 (Añade el CODE 2)
MAPEO_158 = MAPEO_COMUN.copy()
MAPEO_158['ZTUEV_CONTACT_PERSON_STRUC-NUMMER_MDG'] = 'CUSTOMER CODE 2'

# ==============================================================================
# 🚀 PROCESO
# ==============================================================================
if os.path.exists(RUTA_CARPETA):
    os.chdir(RUTA_CARPETA)
    print(f"📂 Trabajando en: {RUTA_CARPETA}")
else:
    print(f"❌ No existe la carpeta: {RUTA_CARPETA}")
    exit()

warnings.filterwarnings('ignore')

def procesar_archivo(patron, diccionario_mapeo, codigo_entidad):
    archivos = glob.glob(patron)
    if not archivos:
        print(f"⚠️ No hay archivos para entidad {codigo_entidad}")
        return pd.DataFrame()
    
    archivo = archivos[0]
    print(f"📄 Procesando {codigo_entidad}: {archivo} ...")
    
    try:
        df = pd.read_excel(archivo)
        
        # 1. Renombrar columnas
        df = df.rename(columns=diccionario_mapeo)
        
        # 2. Poner Entidad
        df['ENTITY'] = codigo_entidad
        
        # 3. Asegurar que existen todas las columnas finales
        # (Esto es clave para el archivo 0135 que no tiene CODE 2)
        for col in COLUMNAS_FINALES:
            if col not in df.columns:
                df[col] = None 
        
        # 4. Limpieza de CP (Texto para no perder ceros)
        if 'CUSTOMER POSTAL CODE' in df.columns:
             df['CUSTOMER POSTAL CODE'] = df['CUSTOMER POSTAL CODE'].astype(str).str.replace(r'\.0$', '', regex=True).replace('nan', '')

        # 5. Devolver solo lo que nos interesa
        return df[COLUMNAS_FINALES].copy()

    except Exception as e:
        print(f"❌ Error en {archivo}: {e}")
        return pd.DataFrame()

# --- EJECUCIÓN ---
print("\n🔄 Generando Excel Unificado...")

# Procesamos 135 (Usando mapeo común, CODE 2 se creará vacío)
df_135 = procesar_archivo(PATRON_135, MAPEO_COMUN, "135")

# Procesamos 158 (Usando mapeo específico que incluye CODE 2)
df_158 = procesar_archivo(PATRON_158, MAPEO_158, "158")

# Unimos
df_total = pd.concat([df_135, df_158], ignore_index=True)

if not df_total.empty:
    try:
        df_total.to_excel(ARCHIVO_SALIDA, index=False)
        print(f"\n✅ ¡LISTO! Archivo creado: {ARCHIVO_SALIDA}")
        print(f"   Filas Totales: {len(df_total)}")
    except PermissionError:
        print(f"\n❌ ERROR: Cierra '{ARCHIVO_SALIDA}' antes de ejecutar.")
else:
    print("\n❌ Error: No se generaron datos.")