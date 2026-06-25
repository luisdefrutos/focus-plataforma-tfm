import pandas as pd
import re

# -------------------------------
# Cargar el Excel
# -------------------------------
archivo_excel = "clientesTotales0135.xlsx"  # Cambia por el nombre de tu archivo
hoja = "Sheet1"  # Cambia por el nombre de tu hoja
df = pd.read_excel(archivo_excel, hoja)
# -------------------------------
# Escribir resultados en la columna existente o nueva
# -------------------------------
columna_email = "ZTUEV_CONTACT_PERSON_STRUC-SMTP_ADDRESS"  # Cambiar por nombre de la columna con los emails
columna_resultado = "Email-Validacion" # Nombre de la columna donde se guardará el resultado

# Limpiar posibles espacios en los nombres de las columnas
df.columns = df.columns.astype(str).str.strip()

# -------------------------------
# Reglas de validación de emails
# -------------------------------
def validar_email_detallado(email):
    if pd.isna(email) or str(email).strip() == "":
        return "Vacío"

    email = str(email).strip()

    # 1. Solo un @
    if email.count("@") != 1:
        return "Inválido: cantidad de @ incorrecta"

    local, dominio = email.split("@")

    # 2. Primer o último carácter inválido
    if local.startswith(".") or local.endswith("."):
        return "Inválido: punto al inicio o final del local"
    if dominio.startswith(".") or dominio.endswith("."):
        return "Inválido: punto al inicio o final del dominio"

    # 3. Dos puntos consecutivos
    if ".." in email:
        return "Inválido: doble punto consecutivo"

    # 4. Espacios
    if " " in email:
        return "Inválido: contiene espacio"

    # 5. Longitud total
    if len(email) > 254:
        return "Inválido: email demasiado largo"

    # 6. Dominio con al menos un '.'
    if "." not in dominio:
        return "Inválido: dominio sin punto"

    # 7. Longitud del TLD (último punto)
    tld = dominio.split(".")[-1]
    if not (2 <= len(tld) <= 10):
        return "Inválido: TLD fuera de rango (2-10)"

    # 8. Evitar guiones al inicio o final del dominio
    dominio_partes = dominio.split(".")
    for parte in dominio_partes:
        if parte.startswith("-") or parte.endswith("-"):
            return "Inválido: guion al inicio o final del subdominio"

    # 9. Dominios bloqueados (opcional)
    dominios_bloqueados = ["gmail", "hotmail", "outlook", "yahoo", "icloud", "live", "aol", "msn"]
    partes_dominio = dominio.lower().split(".")
    for bloqueado in dominios_bloqueados:
        if bloqueado in partes_dominio:
            return f"Inválido: dominio bloqueado ({bloqueado})"

    # 10. Regex para validar caracteres permitidos
    pattern = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}$"
    if not re.match(pattern, email):
        return "Inválido: caracteres inválidos"

    return "Válido"


# Verificamos SOLO que exista la columna de origen (la de los emails)
if columna_email not in df.columns:
    raise ValueError(f"No se encontró la columna '{columna_email}'. Revisa los nombres del Excel: {df.columns.tolist()}")

# Nota: No hace falta verificar si 'columna_resultado' existe.
# Pandas la creará automáticamente si no la encuentra.

print(f"Validando emails de la columna '{columna_email}'...")

# Aplicar la función y escribir en la columna (si no existe, se crea sola)
df[columna_resultado] = df[columna_email].apply(validar_email_detallado)
# Reordenas las columnas para moverla
cols = list(df.columns)
cols.remove(columna_resultado) # La sacas del final
indice = cols.index(columna_email) # Buscas dónde va
cols.insert(indice + 1, columna_resultado) # La metes en la lista
df = df[cols] # Aplicas el orden
# -------------------------------
# Guardar el archivo con los cambios
# -------------------------------
with pd.ExcelWriter(archivo_excel, engine='openpyxl', mode='a', if_sheet_exists='replace') as writer:
    df.to_excel(writer, sheet_name=hoja, index=False)
print(f"Validación completada. Resultados guardados en la columna '{columna_resultado}'.")
