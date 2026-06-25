# Informe Ejecutivo: Proyecto Focus
**TÜV LFD España**

## 1. Resumen Ejecutivo
`Focus` es una iniciativa estratégica para transformar la gestión del cliente en `TÜV LFD España`, pasando de un modelo fragmentado por sistemas y unidades de negocio a una plataforma unificada de dato maestro, análisis comercial y activación de oportunidades.

El proyecto propone consolidar en un único entorno la identidad del cliente, sus relaciones corporativas, contactos, ubicaciones, actividad económica y comportamiento comercial, permitiendo una visión `360` real y accionable.

Esta base habilita una nueva capacidad de negocio: segmentar campañas con mayor precisión, detectar clientes compartidos entre `BUs`, identificar `white spots` y generar oportunidades automáticas de venta cruzada.

En términos ejecutivos, `Focus` no debe entenderse como una base de datos más, sino como una plataforma de crecimiento comercial, colaboración entre unidades de negocio y gobierno del dato.

---

## 2. Situación Actual
Actualmente, la información de cliente se encuentra distribuida entre `Business Warehouse`, `CRM`, `SAP` y diferentes ficheros operativos. Esta situación genera varias limitaciones estructurales:

- No existe una visión consolidada del cliente a nivel corporativo.
- La identificación de relaciones entre clientes, holdings y distintas líneas de negocio es incompleta o manual.
- La segmentación comercial depende de trabajo analítico disperso y poco industrializado.
- La trazabilidad sobre contactos, origen del dato y criterios de privacidad no está centralizada.
- El histórico comercial y de facturación no está estructurado de forma homogénea para soportar campañas, renovaciones o detección de oportunidades.

Como consecuencia, la organización pierde capacidad de crecimiento, incrementa el esfuerzo operativo y limita su capacidad para trabajar con una estrategia comercial transversal centrada en el cliente.

---

## 3. Necesidad de Negocio
La evolución del negocio exige una plataforma capaz de responder a preguntas que hoy no se resuelven de manera eficiente:

- Qué relación total mantiene un cliente con `TÜV LFD`.
- Qué clientes trabajan ya con una `BU` pero no con otras.
- Qué grupos empresariales presentan potencial de expansión.
- Qué sectores concentran mejores oportunidades comerciales.
- Qué clientes deben priorizarse por volumen, recurrencia o cercanía de renovación.

`Focus` nace para cubrir esta necesidad, conectando dato maestro, analítica comercial y activación operativa en un único modelo.

---

## 4. Objetivo del Proyecto
El objetivo de `Focus` es construir una plataforma corporativa que permita unificar el dato cliente y convertirlo en una palanca de negocio.

Los objetivos concretos del piloto son:

1. Unificar cada cliente en un `Golden Record` fiable y trazable.
2. Relacionar cliente, holding, `BU`, direcciones, contactos y actividad económica.
3. Consolidar histórico comercial y de facturación para medir actividad, recurrencia y potencial.
4. Habilitar segmentación avanzada para campañas y acciones comerciales.
5. Detectar oportunidades de venta cruzada entre `BUs` a partir de reglas de negocio y patrones de comportamiento.
6. Dar continuidad a la capacidad analítica hoy explotada en `Power BI`, evolucionándola a un modelo corporativo más robusto y escalable.

---

## 5. Propuesta de Solución
La propuesta funcional se apoya en cuatro bloques complementarios.

### 5.1 Registro Maestro del Cliente
El núcleo del modelo es un `Golden Record` por cliente, consolidado a partir de `CIF/NIF` o identificador fiscal equivalente. Este registro actúa como punto de referencia para todas las relaciones posteriores.

### 5.2 Estructura Relacional de Negocio
El cliente se conecta con:

- `Holdings` o agrupaciones corporativas.
- `Business Units`.
- direcciones y centros operativos.
- contactos.
- actividad económica mediante `CNAE`.

Esto permite entender no solo quién es el cliente, sino también cómo opera, en qué sector se mueve y con qué áreas de `TÜV LFD` ya se relaciona.

### 5.3 Inteligencia Comercial
El modelo incorpora histórico comercial y de facturación, catálogo de servicios y un motor de oportunidades. Esto permite identificar actividad reciente, volumen económico, recurrencia, servicios contratados y señales de expansión comercial.

### 5.4 Activación Comercial
Sobre esa base se habilitan casos de uso concretos para negocio:

- buscador `360` de cliente,
- segmentación para campañas,
- detección de clientes compartidos,
- detección de `white spots`,
- generación de oportunidades de `cross-sell`.

---

## 6. Capacidades Clave para Dirección
`Focus` aporta capacidades diferenciales de alto valor para dirección:

### 6.1 Visión 360 del Cliente
Permite conocer de forma consolidada la relación total de un cliente con `TÜV LFD`, independientemente de la `BU` con la que opere.

### 6.2 Segmentación Comercial Avanzada
Permite construir audiencias y campañas combinando filtros por:

- `BU`,
- geografía,
- holding,
- servicios contratados,
- volumen de facturación,
- recurrencia,
- actividad económica `CNAE`.

### 6.3 Clasificación Sectorial por CNAE
La incorporación de `CNAE` añade una dimensión estratégica para entender el perfil sectorial del cliente y lanzar campañas específicas por industria.

### 6.4 Detección de White Spots
Permite identificar clientes relevantes que ya trabajan con una línea de negocio pero todavía no tienen presencia en otras `BUs` donde existe potencial comercial.

### 6.5 Venta Cruzada Automática
Permite detectar oportunidades a partir de reglas basadas en comportamiento histórico, sector, recurrencia, proximidad de renovación o comparación con clientes similares.

### 6.6 Gobierno y Trazabilidad
Refuerza el control sobre el dato mediante trazabilidad de origen, referencias técnicas de carga y definición de ownership sobre contactos y relaciones de negocio.

---

## 7. Evolución del Modelo de Información
El diseño funcional y técnico actualizado incorpora mejoras relevantes respecto al planteamiento inicial.

### 7.1 Dimensión CNAE
Se incorpora una tabla maestra de `CNAE` y una relación entre clientes y `CNAEs`, permitiendo asignar actividad principal y actividades secundarias cuando aplique.

### 7.2 Enriquecimiento del Histórico Comercial
`Billing Records` amplía su alcance con nuevos atributos de negocio:

- `invoice_amount`,
- `invoice_date`,
- `invoice_description`.

Esto permite pasar de un histórico básico a una base de análisis comercial con mayor valor para campañas, priorización y reporting.

### 7.3 Oportunidades con Contexto Comercial
Las oportunidades de `cross-sell` incluyen mayor información para su gestión:

- `BU` origen,
- `BU` objetivo,
- servicio sugerido,
- motivo de la recomendación,
- prioridad,
- potencial económico.

---

## 8. Casos de Uso Prioritarios
Los principales casos de uso previstos para el piloto son los siguientes.

### 8.1 Lanzamiento de Campañas
Un responsable de negocio podrá construir segmentos de clientes usando filtros comerciales y sectoriales, obteniendo listas de trabajo accionables y con contexto suficiente para la actividad comercial.

### 8.2 Detección de Oportunidades Automáticas
El sistema podrá identificar clientes con actividad reciente en una `BU` y alto potencial de contratación en otra, generando oportunidades priorizadas de venta cruzada.

### 8.3 Identificación de White Spots
Se podrán detectar clientes estratégicos con baja penetración de servicios, apoyando planes de crecimiento transversal por `BU` o familia de servicio.

### 8.4 Segmentación por Sector
La dimensión `CNAE` permitirá campañas específicas para determinados sectores, mejorando precisión, relevancia y especialización comercial.

---

## 9. Beneficios Esperados
La implantación de `Focus` debe generar beneficios claros en términos de negocio y gestión:

- incremento del potencial de venta cruzada entre unidades de negocio,
- mayor eficiencia comercial gracias a campañas más precisas,
- mejor capacidad para identificar clientes estratégicos y holdings,
- reducción del trabajo manual de consolidación y explotación,
- mejora de la calidad, trazabilidad y gobierno del dato,
- base sólida para reporting y toma de decisiones por parte de dirección.

---

## 10. Alcance Recomendado del Piloto
Para maximizar valor y controlar riesgo, el piloto debería centrarse en:

1. consolidación inicial del `Golden Record` a partir de las fuentes ya identificadas,
2. despliegue del nuevo modelo de datos maestro y comercial,
3. segmentación inicial por `BU`, geografía, facturación y `CNAE`,
4. configuración de reglas iniciales de `white spots` y `cross-sell`,
5. entrega de primeras salidas ejecutivas y comerciales para validación con negocio.

Este enfoque permite demostrar valor tangible sin asumir desde el inicio un alcance excesivo.

---

## 11. Riesgos y Factores de Éxito
El éxito del proyecto dependerá de gestionar adecuadamente varios factores clave:

### Riesgos
- calidad y homogeneidad de los datos de origen,
- necesidad de reglas claras de deduplicación y priorización,
- definición de privacidad y ownership del dato de contacto,
- adopción real por parte de negocio,
- riesgo de ampliar alcance antes de validar el piloto.

### Factores de Éxito
- alineamiento claro con dirección comercial y negocio,
- priorización de casos de uso concretos,
- modelo de datos robusto pero pragmático,
- gobierno del dato desde el inicio,
- foco en entregables con valor visible para dirección.

---

## 12. Próximos Pasos Recomendados
Se recomienda avanzar en la siguiente secuencia:

1. Validar con dirección el alcance del piloto y los casos de uso prioritarios.
2. Confirmar fuentes iniciales y reglas maestras de consolidación.
3. Ejecutar una primera carga piloto sobre el nuevo esquema de base de datos.
4. Definir indicadores de éxito del piloto.
5. Preparar una demostración ejecutiva centrada en segmentación, `white spots` y oportunidades de venta cruzada.

---

## 13. Conclusión
`Focus` ofrece a `TÜV LFD` la oportunidad de evolucionar desde un entorno fragmentado de información hacia una plataforma corporativa centrada en el cliente, capaz de combinar conocimiento, control y crecimiento comercial.

La relevancia del proyecto no reside únicamente en ordenar el dato, sino en convertirlo en una ventaja competitiva: mejor segmentación, mayor capacidad de `cross-sell`, visión compartida entre `BUs` y mejor soporte a la toma de decisiones de dirección.

En este sentido, `Focus` debe considerarse una iniciativa estratégica de negocio apoyada en datos, y no únicamente un esfuerzo técnico de integración.
