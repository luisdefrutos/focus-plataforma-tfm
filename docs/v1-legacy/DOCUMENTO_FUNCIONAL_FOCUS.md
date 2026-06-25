# Diseño Funcional: Proyecto Focus (TÜV LFD)
**Visión Estratégica: El Cliente como Centro del Negocio**

## 1. Introducción: ¿Por qué nace Focus?
Actualmente, la información de nuestros clientes reside en múltiples "silos" (Business Warehouse, CRM, SAP y otras extracciones operativas). Esto genera:
*   **Falta de Visión 360**: No sabemos con fiabilidad si un cliente de ITV es también un cliente relevante de Industria, si pertenece a un grupo empresarial mayor o si ya trabaja con otras BUs.
*   **Limitaciones Comerciales**: La segmentación para campañas, el análisis de recurrencia, la identificación de clientes compartidos y la detección de oportunidades de venta cruzada requieren mucho trabajo manual.
*   **Riesgo Legal y Operativo**: La gestión de la privacidad (RGPD), los contactos y la trazabilidad del origen del dato están dispersos entre distintos sistemas.
*   **Baja Capacidad Analítica**: El histórico de facturación y servicios no está estructurado de manera uniforme para explotar patrones comerciales, renovaciones o huecos de cobertura.

**Focus** nace como una **plataforma de dato cliente y activación comercial** que unifica toda esta información en un **Dato Maestro (Golden Record)** único por cada CIF/NIF o identificador fiscal equivalente, y la convierte en una base de trabajo para:
*   consultar y entender al cliente de forma unificada,
*   segmentar audiencias para campañas comerciales,
*   identificar clientes compartidos entre BUs,
*   detectar oportunidades de cross-sell y white spots,
*   mejorar la trazabilidad y el gobierno del dato.

---

## 2. Objetivo del Piloto
El piloto de Focus tiene como objetivo construir una base sólida y escalable para el trabajo comercial y analítico sobre clientes de TÜV LFD España.

Los objetivos concretos son:
1.  **Unificar el cliente** en un registro maestro fiable, evitando duplicidades y consolidando la identidad legal y comercial.
2.  **Relacionar cliente, holding, BU, ubicaciones, contactos y actividad económica** para disponer de una visión de negocio completa.
3.  **Consolidar histórico comercial y de facturación** para analizar recurrencia, volumen económico, servicios ya contratados y posibles renovaciones.
4.  **Permitir segmentación avanzada** para campañas mediante filtros de negocio relevantes.
5.  **Detectar oportunidades de venta cruzada** entre BUs a partir de reglas de negocio, comportamiento histórico y características del cliente.
6.  **Dar continuidad y mejorar el modelo analítico actual**, actualmente explotado en Power BI, trasladándolo a una base maestra preparada para crecimiento futuro.

---

## 3. Principios de Diseño Funcional
Focus debe construirse sobre los siguientes principios:

1.  **Cliente único**: Cada cliente debe disponer de un registro maestro único, priorizando CIF/NIF o identificador fiscal equivalente como ancla de consolidación.
2.  **Separación entre dato maestro y dato analítico**: El modelo debe distinguir claramente entre identidad del cliente, estructura organizativa, contactos y hechos comerciales.
3.  **Trazabilidad**: Cada dato debe conservar origen, fecha de carga y referencia técnica de proceso para auditoría y control.
4.  **Escalabilidad**: El diseño debe permitir incorporar nuevas BUs, nuevas fuentes y nuevas reglas comerciales sin rediseñar la estructura principal.
5.  **Orientación al negocio**: La información debe poder utilizarse no solo para consulta, sino también para segmentación, priorización y activación comercial.
6.  **Gobierno y privacidad**: Los datos de contacto y las relaciones entre BUs deben respetar las reglas de privacidad y propiedad del dato que se definan.

---

## 4. Los Pilares Funcionales (Nuestra Propuesta)
Hemos diseñado un esquema de piezas funcionales que trabajan juntas para el negocio.

### A. El Mapa de Relaciones (Estructura)
1.  **Agrupaciones Corporativas (Holdings)**: Permite ver la jerarquía corporativa total.  
    *Ejemplo: Ver que Seat, Audi y VW pertenecen al mismo Grupo Volkswagen para negociaciones globales, análisis de penetración y detección de oportunidades en otras sociedades del mismo grupo.*

2.  **Unidades de Negocio (BUs)**: Identifica qué sociedad legal o línea de actividad de TÜV LFD (ITV, Industria, etc.) es propietaria del servicio, de la relación comercial o de la gestión de un dato de contacto.

### B. El Registro Maestro (Identidad)
3.  **Maestro de Clientes (Golden Record)**: Es el ancla central del modelo. Todo se vincula a un CIF/NIF único o identificador fiscal equivalente para minimizar duplicados y permitir una visión transversal por cliente legal.

4.  **Ubicaciones de Actividad (Addresses)**: No solo sabemos quién es el cliente, sino en qué sedes, plantas industriales, delegaciones o centros operativos desarrolla su actividad.

5.  **Personas de Contacto (Contacts)**: Identifica quiénes son nuestros interlocutores válidos para cada cliente, con trazabilidad de la BU responsable del dato y bajo las reglas de privacidad que se definan.

6.  **Clasificación de Actividad (CNAE)**: Permite clasificar a cada cliente por su actividad económica principal y, si aplica, por actividades secundarias. Esta dimensión es clave para filtrar campañas, analizar sectores y detectar servicios complementarios habituales por industria.

### C. La Inteligencia Comercial (Crecimiento)
7.  **Histórico Comercial y de Facturación (Billing Records)**: El sistema recuerda qué ha contratado cada cliente, con qué BU, para qué servicio y en qué momento. Además de las fechas de caducidad o renovación cuando existan, debe almacenar información clave de factura como **invoice_amount**, **invoice_date** e **invoice_description** para enriquecer la analítica comercial.

8.  **Catálogo de Servicios (Product Catalog)**: Un lenguaje común para que todos los departamentos llamen a los servicios de la misma forma, agrupándolos por materiales, familias o categorías comerciales cuando sea necesario.

9.  **Alertas de Venta Cruzada (Cross-Sell Opportunities)**: El cerebro comercial del sistema. Genera avisos automáticos cuando detecta que un cliente, por su histórico, BU actual, nivel de facturación, CNAE, próximas renovaciones o comportamiento del holding, puede necesitar un servicio complementario.

### D. La Activación Comercial (Uso de Negocio)
10. **Segmentación y Búsqueda Comercial**: Focus debe permitir construir listas de trabajo y campañas mediante filtros combinables por BU, localización, holding, facturación, recurrencia, catálogo, estado comercial y CNAE.

11. **Detección de White Spots**: El sistema debe facilitar la identificación de clientes que ya trabajan con una BU pero todavía no tienen presencia en otras BUs donde existe potencial comercial.

---

## 5. Entidades y Relaciones Clave
Para que el modelo sea funcionalmente consistente, deben contemplarse las siguientes relaciones:

*   Un **holding** puede agrupar múltiples clientes legales.
*   Un **cliente** puede tener varias direcciones o centros de actividad.
*   Un **cliente** puede tener múltiples contactos.
*   Un **cliente** puede estar asociado a uno o varios CNAEs, distinguiendo entre principal y secundarios cuando aplique.
*   Un **cliente** puede haber contratado múltiples servicios con distintas BUs a lo largo del tiempo.
*   Un **registro de facturación** debe vincularse al cliente, a la BU y al catálogo de servicios.
*   Una **oportunidad comercial** puede originarse a partir de un servicio ya contratado, una próxima renovación, una combinación cliente-CNAE o la comparación con patrones de otros clientes similares.

---

## 6. Reglas Maestras de Dato
Para garantizar la calidad del Golden Record, el modelo funcional debe contemplar estas reglas:

1.  **Regla de identidad principal**: El cliente se consolidará prioritariamente por CIF/NIF o identificador fiscal equivalente.
2.  **Gestión de duplicados**: Cuando existan variaciones de nombre, formato o procedencia entre sistemas, Focus deberá resolverlas según reglas de priorización y matching.
3.  **Trazabilidad del origen**: Cada registro debe conservar sistema origen, fecha de inserción y referencia de proceso ETL.
4.  **Separación entre cliente legal y centro operativo**: El cliente maestro representa la entidad legal; las ubicaciones representan plantas, sedes o centros de actividad.
5.  **Gobierno del dato de contacto**: Los contactos deberán poder vincularse a una BU responsable del dato.
6.  **CNAE como dimensión de segmentación**: El CNAE debe poder consultarse y explotarse como filtro comercial y como atributo para reglas analíticas.

---

## 7. Capacidades de Segmentación Comercial
Focus debe permitir construir segmentos de clientes con filtros combinables como mínimo por:

*   Unidad de Negocio.
*   Provincia, ciudad o ubicación de actividad.
*   Holding o grupo empresarial.
*   Cliente con o sin actividad en una BU concreta.
*   Servicio o categoría de servicio contratada.
*   Fecha de última factura.
*   Volumen de facturación.
*   Clientes recurrentes o no recurrentes.
*   Próximas caducidades o renovaciones.
*   CNAE principal o secundario.
*   Clientes compartidos entre BUs.
*   Clientes sin presencia en determinadas líneas de servicio.

Esta capacidad debe cubrir, como mínimo, los casos de uso que actualmente se explotan de manera analítica en Power BI, como buscador de clientes, segmentación por facturación, clientes que repiten, clientes que no repiten y detección de white spots.

---

## 8. Reglas de Inteligencia Comercial y Cross-Sell
La detección de oportunidades no debe quedar descrita de forma genérica, sino apoyarse en reglas funcionales concretas. Algunos ejemplos:

1.  **Renovación próxima**: Si un servicio dispone de fecha de caducidad o fecha esperada de renovación, el sistema genera una alerta previa para preparar acción comercial.
2.  **Cliente activo en una BU pero no en otra**: Si un cliente factura de forma recurrente en una BU y no consume servicios de otra BU con alto encaje, se genera oportunidad de venta cruzada.
3.  **Patrón sectorial por CNAE**: Si clientes de un determinado CNAE suelen contratar un conjunto de servicios y un cliente equivalente no los tiene, el sistema identifica un white spot.
4.  **Importe elevado con baja diversificación**: Si un cliente tiene facturación relevante pero concentrada en pocos servicios, se marca como candidato a expansión de cartera.
5.  **Efecto holding**: Si una sociedad del holding consume un servicio y otras no, se puede generar una recomendación comercial sobre el resto del grupo.

Las oportunidades deben permitir, al menos, almacenar:
*   cliente,
*   BU origen,
*   BU objetivo,
*   servicio sugerido,
*   motivo de la recomendación,
*   prioridad o score,
*   estado de gestión.

---

## 9. Valor para el Negocio (Casos de Uso)

### Escenario 1: Lanzamiento de campañas.
> **Situación**: Un responsable de una BU quiere lanzar una campaña para clientes de otras BUs en unas provincias específicas, orientada a un determinado sector o tipo de actividad.
> **Acción Focus**: Selección mediante buscador y filtros combinados por BU actual, provincia, histórico de servicios, volumen de facturación, recurrencia y CNAE.
> **Resultado**: Lista priorizada de clientes y contactos aptos para campaña, con trazabilidad del origen del dato y contexto comercial suficiente para la acción.

### Escenario 2: Detección de oportunidades de venta automáticamente.
> **Situación**: Un cliente pertenece a un sector con alto potencial comercial, ya contrata servicios con una BU y presenta actividad o facturación reciente, pero no consume servicios complementarios de otras BUs.
> **Acción Focus**: El sistema cruza histórico de facturación, catálogo de servicios, BU actual, fechas relevantes, comportamiento de clientes similares y CNAE para detectar patrones de venta cruzada.
> **Resultado**: Lista priorizada de oportunidades con cliente, BU origen, BU objetivo, servicio sugerido, motivo de la recomendación e indicadores de valor potencial.

### Escenario 3: Identificación de white spots.
> **Situación**: Dirección comercial quiere identificar clientes relevantes que ya trabajan con TÜV LFD, pero cuya relación está concentrada en una sola línea de negocio.
> **Acción Focus**: Análisis cruzado por cliente, holding, BUs activas, catálogo contratado y facturación acumulada.
> **Resultado**: Mapa de clientes con huecos comerciales por BU o familia de servicio, utilizable como base para planes de crecimiento.

### Escenario 4: Segmentación por actividad económica.
> **Situación**: Un responsable comercial quiere lanzar una campaña dirigida exclusivamente a clientes de determinados sectores.
> **Acción Focus**: Filtrado por CNAE principal o secundario, combinado con geografía, BU, facturación o servicios previos.
> **Resultado**: Público objetivo preciso, homogéneo y accionable para campañas especializadas por industria.

---

## 10. Implicaciones para el Modelo de Datos
El modelo de base de datos actual cubre el núcleo funcional, pero para alinearse completamente con el objetivo de negocio debe contemplar las siguientes ampliaciones:

1.  **Dimensión CNAE**:
    * tabla maestra de CNAEs,
    * tabla relacional entre cliente y CNAE,
    * soporte para CNAE principal y secundarios.

2.  **Ampliación de Billing Records**:
    * **invoice_amount** para analizar valor económico,
    * **invoice_date** para medir recencia y actividad,
    * **invoice_description** para disponer de contexto comercial adicional.

3.  **Posibles ampliaciones futuras recomendables**:
    * número de factura,
    * moneda,
    * año y mes de facturación,
    * fechas de inicio y fin de servicio,
    * score o potencial económico de la oportunidad,
    * motivo de generación de la oportunidad.

Estas ampliaciones no cambian la filosofía del diseño actual, sino que lo convierten en una base más útil para explotación comercial real.

---

## 11. Salidas Esperadas del Sistema
Focus debe estar preparado para ofrecer, como mínimo:

*   búsqueda 360 de cliente,
*   listados segmentados para campañas,
*   análisis de clientes compartidos entre BUs,
*   identificación de clientes recurrentes o no recurrentes,
*   detección de white spots,
*   cola de oportunidades de venta cruzada,
*   base de explotación para reporting y cuadros de mando.

---

## 12. Conclusión
El Proyecto Focus no es solo una base de datos; es una **plataforma estratégica de conocimiento y activación comercial** para que TÜV LFD pase de trabajar con información fragmentada a operar con una visión unificada, accionable y gobernada del cliente.

La combinación de **Golden Record**, histórico comercial, catálogo común, clasificación por **CNAE**, segmentación avanzada y motor de oportunidades permitirá convertir el dato en una herramienta real de crecimiento, priorización comercial y colaboración entre BUs.
