# Reemplazo de Componentes Propietarios por Diseño Idéntico (Fase 1)

El objetivo es eliminar por completo la dependencia del paquete `@tuvsud/design-system` y sustituirlo por componentes propios basados en **Shadcn UI y Tailwind CSS**, garantizando que la aplicación se vea y funcione **exactamente igual** a la versión original mostrada en el vídeo.

## Problema Actual (Bloqueo del Servidor)
> [!CAUTION]
> En la última captura que enviaste, el navegador indica **"Next.js (stale) Turbopack"**. Esto significa que el servidor de desarrollo se quedó congelado en memoria por los errores de compilación anteriores y **no está cargando el código que ya he corregido**.
> **Antes de continuar**, debes ir a tu terminal, pulsar `Ctrl + C` para detener el servidor y volver a ejecutar `npm run dev`. Solo así desaparecerá el error rojo en tu pantalla.

## Cambios Propuestos

### 1. Estilos Globales y Layout
- Configurar Tailwind (`globals.css` y `tailwind.config.ts`) con la paleta de colores corporativa exacta (Azul primario `#002554`, grises específicos para bordes y fondos).
- Reconstruir la **Barra Lateral (Sidebar)** y la **Barra Superior (Topbar)** usando HTML/Tailwind para que la disposición, márgenes, logos y avatares sean idénticos al diseño original.

### 2. Reconstrucción de Componentes Base (Mocks -> Reales)
Actualmente tenemos componentes "falsos" (mocks) en la carpeta `mock-design-system`. Vamos a transformarlos en componentes reales y robustos que imiten la estética original:
- **`TsInput` / `TsSelect`**: Añadir etiquetas (`labels`) integradas, estados de foco (anillo azul), y soporte completo para selección múltiple (chips) en los filtros.
- **`TsButton`**: Estilos sólidos y "ghost" exactos.
- **`TsIcon`**: Mapeo completo de todos los iconos usados en la app (alertas, menús, usuarios, gráficas) utilizando `lucide-react` con los tamaños y colores correctos.
- **`TsTable` / Tablas**: Replicar el diseño de las tablas de datos (cabeceras grises, bordes finos, paginación idéntica).

### 3. Revisión de Pantallas
- **Dashboard**: Asegurar que las tarjetas de KPI tengan las dimensiones, sombras e iconos de fondo correspondientes.
- **Buscador/Filtros (Oportunidades/Clientes)**: Asegurar que el layout responsivo y la disposición en columnas coincida con la aplicación original, sin solapamiento de controles.

## Open Questions

> [!IMPORTANT]
> 1. ¿Puedes confirmar que has reiniciado el servidor (`npm run dev`) y que el error rojo ha desaparecido?
> 2. ¿Estás de acuerdo con este plan para estabilizar primero lo visual antes de pasar a la anonimización de datos y GitHub?

## Verification Plan
1. Iniciar la aplicación y navegar por el Dashboard, Clientes y Oportunidades.
2. Comparar visualmente los márgenes, colores y controles con el vídeo original.
3. Comprobar que los filtros y menús desplegables funcionan sin errores de hidratación (React).
