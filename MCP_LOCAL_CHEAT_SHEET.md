# MCP local - Cheat Sheet

## 1) Archivos importantes

- `c:\Dev\focus\.mcp.json`
- `c:\Dev\focus\app\mcp-server.mjs`
- `c:\Dev\focus\.gitignore`

> Estas configuraciones son locales y no deben compartirse en Git.

---

## 2) Instalar dependencias solo en tu máquina

Abre PowerShell en `c:\Dev\focus\app` y ejecuta:

```powershell
cd c:\Dev\focus\app
npm install --no-save @modelcontextprotocol/server mysql2 zod @cfworker/json-schema
```

- `--no-save` evita que se modifique `package.json` o `package-lock.json`.

---

## 3) Arrancar el servidor MCP local

Desde la raíz del repositorio:

```powershell
cd c:\Dev\focus
npx --yes --prefix app node app/mcp-server.mjs mysql://focus_app:G2Q5XuUMSVwZykx%23Ub91@localhost:3306/focus_dev
```

### Resultado esperado

- `Arrancando servidor MCP local...`
- `Servidor MCP conectado por stdio.`

---

## 4) Configuración local de `.mcp.json`

Tu `.mcp.json` debería tener esta entrada:

```json
{
  "mcpServers": {
    "focus-mysql-local": {
      "command": "npx",
      "args": [
        "--yes",
        "--prefix",
        "app",
        "node",
        "app/mcp-server.mjs",
        "mysql://focus_app:G2Q5XuUMSVwZykx%23Ub91@localhost:3306/focus_dev"
      ]
    }
  }
}
```

> Este archivo no se debe compartir si está en tu carpeta local.

---

## 5) Evitar que se suban cambios de configuración personal

Asegúrate de que `.gitignore` incluye:

```gitignore
.mcp.json
app/mcp-server.mjs
```

De esta forma, tu servidor MCP local no afecta al resto del equipo.

---

## 6) Detener el servidor

Pulsa `Ctrl+C` en la terminal donde está ejecutándose.

---

## 7) Problemas comunes

- Si no arranca, comprueba que MySQL está en `localhost:3306`.
- Si la URL tiene caracteres especiales, deben ir codificados (`#` => `%23`).
- Si el servidor no se conecta, revisa permisos y existencia de la base `focus_dev`.
