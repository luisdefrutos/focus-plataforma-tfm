/*
  ==============================================================================
  PROJECT FOCUS - UPDATED ORACLE DATABASE SETUP SCRIPT
  ==============================================================================
  Author: Coding Assistant
  Date: 2026-04-16
  Strategy: Internal sequences + automatic GUID triggers + commercial enrichment.

  -- RESUMEN EJECUTIVO PARA EL JEFE DE PROYECTO:
  -- 1. OBJETIVO: Este script crea la base del Golden Record de TÜV SÜD y la
  --    amplía para segmentación comercial, CNAE y detección de cross-sell.
  -- 2. CALIDAD DEL DATO: Se mantienen controles de unicidad, formato y
  --    trazabilidad técnica mediante source_system, created_at y etl_run_id.
  -- 3. POTENCIAL COMERCIAL: La estructura de facturación incorpora importe,
  --    fecha y descripción de factura para enriquecer campañas y analítica.
  -- 4. SEGMENTACIÓN: Se añade una dimensión CNAE con relación N:M con clientes.
  -- 5. ACTIVACIÓN: Las oportunidades comerciales pasan a guardar BU origen,
  --    BU objetivo, motivo, score y potencial económico. 
  

  ------------------------------------------------------------------------------
  -- GUÍA PARA DESARROLLADORES:
  -- 1. PK internas numéricas automáticas vía sequences + triggers.
  -- 2. GUID externo autogenerado si se omite; validación UUID activa.
  -- 3. Auditoría funcional y técnica en todas las tablas principales.
  -- 4. El diseño está preparado para ETLs incrementales y reporting analítico.
  ------------------------------------------------------------------------------
*/


-- 1. SAFE DROP CLEANUP (Checks existence before dropping)
BEGIN
    FOR i IN (SELECT table_name FROM user_tables WHERE table_name IN (
        'CAMPAIGN_TARGETS',
        'COMMERCIAL_CAMPAIGNS',
        'APP_ROLE_PERMISSIONS',
        'APP_USER_ROLES',
        'APP_PERMISSIONS',
        'APP_ROLES',
        'APP_USERS',
        'CROSS_SELL_EXCLUSIONS',
        'CUSTOMER_CNAE',
        'CNAE_CATALOG',
        'CROSS_SELL_OPPORTUNITIES',
        'BILLING_RECORDS',
        'CONTACTS',
        'ADDRESSES',
        'CUSTOMER_MASTER',
        'PRODUCT_CATALOG',
        'BUSINESS_UNITS',
        'CORPORATE_HOLDINGS',
        'STATUS_CATALOG'
    )) LOOP
        EXECUTE IMMEDIATE 'DROP TABLE ' || i.table_name || ' CASCADE CONSTRAINTS';
    END LOOP;

    FOR i IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN (
        'SEQ_HOLDING_ID',
        'SEQ_BU_ID',
        'SEQ_CATALOG_ID',
        'SEQ_CUSTOMER_ID',
        'SEQ_ADDRESS_ID',
        'SEQ_CONTACT_ID',
        'SEQ_TARGET_ID',
        'SEQ_CAMPAIGN_ID',
        'SEQ_PERMISSION_ID',
        'SEQ_ROLE_ID',
        'SEQ_USER_ID',
        'SEQ_EXCLUSION_ID',
        'SEQ_CNAE_ID',
        'SEQ_CUSTOMER_CNAE_ID',
        'SEQ_BILLING_ID',
        'SEQ_OPPORTUNITY_ID',
        'SEQ_STATUS_ID'
    )) LOOP
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || i.sequence_name;
    END LOOP;
END;
/

-- 2. CREATE SEQUENCES
CREATE SEQUENCE SEQ_HOLDING_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_BU_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_CATALOG_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_CUSTOMER_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_ADDRESS_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_CONTACT_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_CNAE_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_CUSTOMER_CNAE_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_BILLING_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_OPPORTUNITY_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_EXCLUSION_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_USER_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_ROLE_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_PERMISSION_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_CAMPAIGN_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_TARGET_ID START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE SEQ_STATUS_ID START WITH 1 INCREMENT BY 1 NOCACHE;

-- 3. CREATE TABLES

-- 3.0 STATUS_CATALOG (Tabla maestra de estados del sistema)
CREATE TABLE STATUS_CATALOG (
    status_id      NUMBER(10) PRIMARY KEY,
    entity_name    VARCHAR2(64) NOT NULL,
    status_code    VARCHAR2(32) NOT NULL,
    status_name    VARCHAR2(128) NOT NULL,
    description    VARCHAR2(500),
    display_order  NUMBER(3),
    is_active      CHAR(1) DEFAULT 'Y' NOT NULL,
    CONSTRAINT UK_STATUS_ENTITY_CODE UNIQUE (entity_name, status_code),
    CONSTRAINT CHK_STATUS_ACTIVE CHECK (is_active IN ('Y', 'N'))
);

-- Carga inicial de estados
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'NEW', 'Nueva', 'Oportunidad recién generada, sin revisar.', 1);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'ACCEPTED', 'Aceptada', 'Oportunidad aceptada para gestión por un comercial.', 2);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'IN_PROGRESS', 'En progreso', 'En evaluación por un comercial.', 3);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'IN_CAMPAIGN', 'En campaña', 'Vinculada a una campaña activa.', 4);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'QUALIFIED', 'Cualificada', 'Confirmada como oportunidad real.', 5);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'REJECTED', 'Rechazada', 'Descartada tras evaluación.', 6);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'CLOSED_WON', 'Ganada', 'Convertida en venta efectiva.', 7);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'OPPORTUNITY', 'CLOSED_LOST', 'Perdida', 'No materializada.', 8);

INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'CAMPAIGN', 'DRAFT', 'Borrador', 'Campaña en preparación.', 1);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'CAMPAIGN', 'ACTIVE', 'Activa', 'Campaña en ejecución.', 2);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'CAMPAIGN', 'COMPLETED', 'Completada', 'Campaña finalizada.', 3);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'CAMPAIGN', 'CANCELLED', 'Cancelada', 'Campaña cancelada.', 4);

INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'TARGET', 'PENDING', 'Pendiente', 'Pendiente de contactar.', 1);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'TARGET', 'CONTACTED', 'Contactado', 'Contactado, esperando resultado.', 2);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'TARGET', 'CONVERTED', 'Convertido', 'Derivó en contratación.', 3);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'TARGET', 'REJECTED', 'Rechazado', 'El cliente rechazó la propuesta.', 4);

INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'EXCLUSION', 'PERMANENT', 'Permanente', 'Sin caducidad, vigente hasta desactivación.', 1);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'EXCLUSION', 'TEMPORARY', 'Temporal', 'Vigencia acotada entre fechas.', 2);
INSERT INTO STATUS_CATALOG (status_id, entity_name, status_code, status_name, description, display_order) VALUES (SEQ_STATUS_ID.NEXTVAL, 'EXCLUSION', 'MARKETING_ONLY', 'Solo marketing', 'Solo afecta a campañas de marketing.', 3);

COMMIT;

/*
   NOTA DE DISEÑO: STATUS_CATALOG - RELACIÓN LÓGICA
   -----------------------------------------------
   STATUS_CATALOG NO tiene Foreign Keys físicas desde las tablas operativas.
   Los campos status/exclusion_type se validan mediante CHECK constraints.
   
   Correspondencia lógica:
   - OPPORTUNITY  → CROSS_SELL_OPPORTUNITIES.status
   - CAMPAIGN     → COMMERCIAL_CAMPAIGNS.status
   - TARGET       → CAMPAIGN_TARGETS.status
   - EXCLUSION    → CROSS_SELL_EXCLUSIONS.exclusion_type
   
   Justificación: Los estados son estables, los CHECK son más eficientes,
   y almacenar el texto directamente mantiene las queries legibles.
   STATUS_CATALOG sirve a la capa de aplicación (desplegables, traducciones).
   
   Al añadir un nuevo estado: actualizar CHECK constraint + INSERT en STATUS_CATALOG.
*/

-- 3.1 CORPORATE_HOLDINGS
CREATE TABLE CORPORATE_HOLDINGS (
    holding_id    NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    holding_name  VARCHAR2(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_HOLDING_GUID UNIQUE (external_guid),
    CONSTRAINT UK_HOLDING_NAME UNIQUE (holding_name),
    CONSTRAINT CHK_HOLDING_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.2 BUSINESS_UNITS
CREATE TABLE BUSINESS_UNITS (
    bu_id         NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    sap_code      VARCHAR2(10) NOT NULL,
    bu_name       VARCHAR2(100) NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_BU_GUID UNIQUE (external_guid),
    CONSTRAINT UK_BU_SAP_CODE UNIQUE (sap_code),
    CONSTRAINT UK_BU_NAME UNIQUE (bu_name),
    CONSTRAINT CHK_BU_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.3 PRODUCT_CATALOG
CREATE TABLE PRODUCT_CATALOG (
    catalog_id    NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    material_code VARCHAR2(64) NOT NULL,
    description   VARCHAR2(255) NOT NULL,
    category      VARCHAR2(100),
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_CATALOG_GUID UNIQUE (external_guid),
    CONSTRAINT UK_CATALOG_MATERIAL UNIQUE (material_code),
    CONSTRAINT CHK_CATALOG_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.4 CUSTOMER_MASTER
CREATE TABLE CUSTOMER_MASTER (
    customer_id   NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    holding_id    NUMBER(10),
    tax_id        VARCHAR2(64) NOT NULL,
    legal_name    VARCHAR2(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_CUSTOMER_GUID UNIQUE (external_guid),
    CONSTRAINT UK_CUSTOMER_TAX_ID UNIQUE (tax_id),
    CONSTRAINT FK_CM_HOLDING FOREIGN KEY (holding_id) REFERENCES CORPORATE_HOLDINGS(holding_id),
    CONSTRAINT CHK_CUSTOMER_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.5 ADDRESSES
CREATE TABLE ADDRESSES (
    address_id    NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    customer_id   NUMBER(10) NOT NULL,
    full_address  VARCHAR2(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_ADDRESS_GUID UNIQUE (external_guid),
    CONSTRAINT FK_ADD_CUSTOMER FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT CHK_ADDRESS_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.6 CONTACTS
CREATE TABLE CONTACTS (
    contact_id    NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    customer_id   NUMBER(10) NOT NULL,
    bu_id         NUMBER(10) NOT NULL,
    full_name     VARCHAR2(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_CONTACT_GUID UNIQUE (external_guid),
    CONSTRAINT FK_CON_CUSTOMER FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT FK_CON_BU FOREIGN KEY (bu_id) REFERENCES BUSINESS_UNITS(bu_id),
    CONSTRAINT CHK_CONTACT_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.7 CNAE_CATALOG
CREATE TABLE CNAE_CATALOG (
    cnae_id        NUMBER(10) PRIMARY KEY,
    external_guid  VARCHAR2(36) NOT NULL,
    cnae_code      VARCHAR2(10) NOT NULL,
    cnae_name      VARCHAR2(255) NOT NULL,
    cnae_level     VARCHAR2(32),
    created_at     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system  VARCHAR2(64) NOT NULL,
    etl_run_id     NUMBER(20) NOT NULL,
    CONSTRAINT UK_CNAE_GUID UNIQUE (external_guid),
    CONSTRAINT UK_CNAE_CODE UNIQUE (cnae_code),
    CONSTRAINT CHK_CNAE_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.8 CUSTOMER_CNAE
CREATE TABLE CUSTOMER_CNAE (
    customer_cnae_id NUMBER(10) PRIMARY KEY,
    external_guid    VARCHAR2(36) NOT NULL,
    customer_id      NUMBER(10) NOT NULL,
    cnae_id          NUMBER(10) NOT NULL,
    is_primary       CHAR(1) DEFAULT 'N' NOT NULL,
    created_at       TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system    VARCHAR2(64) NOT NULL,
    etl_run_id       NUMBER(20) NOT NULL,
    CONSTRAINT UK_CUSTOMER_CNAE_GUID UNIQUE (external_guid),
    CONSTRAINT UK_CUSTOMER_CNAE_REL UNIQUE (customer_id, cnae_id),
    CONSTRAINT FK_CC_CUSTOMER FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT FK_CC_CNAE FOREIGN KEY (cnae_id) REFERENCES CNAE_CATALOG(cnae_id),
    CONSTRAINT CHK_CUSTOMER_CNAE_PRIMARY CHECK (is_primary IN ('Y', 'N')),
    CONSTRAINT CHK_CUSTOMER_CNAE_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

-- 3.9 BILLING_RECORDS
CREATE TABLE BILLING_RECORDS (
    billing_id           NUMBER(10) PRIMARY KEY,
    external_guid        VARCHAR2(36) NOT NULL,
    customer_id          NUMBER(10) NOT NULL,
    bu_id                NUMBER(10) NOT NULL,
    catalog_id           NUMBER(10) NOT NULL,
    invoice_number       VARCHAR2(64),
    invoice_amount       NUMBER(18,2),
    invoice_date         DATE,
    invoice_description  VARCHAR2(500),
    currency_code        VARCHAR2(3),
    expiry_date          DATE,
    service_start_date   DATE,
    service_end_date     DATE,
    created_at           TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system        VARCHAR2(64) NOT NULL,
    etl_run_id           NUMBER(20) NOT NULL,
    CONSTRAINT UK_BILLING_GUID UNIQUE (external_guid),
    CONSTRAINT FK_BILL_CUSTOMER FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT FK_BILL_BU FOREIGN KEY (bu_id) REFERENCES BUSINESS_UNITS(bu_id),
    CONSTRAINT FK_BILL_CATALOG FOREIGN KEY (catalog_id) REFERENCES PRODUCT_CATALOG(catalog_id),
    CONSTRAINT CHK_BILLING_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    ),
    CONSTRAINT CHK_BILLING_AMOUNT_NONNEG CHECK (invoice_amount IS NULL OR invoice_amount >= 0),
    CONSTRAINT CHK_BILLING_CURRENCY_FMT CHECK (
        currency_code IS NULL OR REGEXP_LIKE(currency_code, '^[A-Z]{3}$')
    )
);

-- 3.10 CROSS_SELL_OPPORTUNITIES
CREATE TABLE CROSS_SELL_OPPORTUNITIES (
    opportunity_id     NUMBER(10) PRIMARY KEY,
    external_guid      VARCHAR2(36) NOT NULL,
    customer_id        NUMBER(10) NOT NULL,
    billing_id         NUMBER(10),
    origin_bu_id       NUMBER(10) NOT NULL,
    target_bu_id       NUMBER(10) NOT NULL,
    catalog_id         NUMBER(10) NOT NULL,
    opportunity_reason VARCHAR2(1000) NOT NULL,
    priority_score     NUMBER(5,2),
    potential_amount   NUMBER(18,2),
    status             VARCHAR2(32) DEFAULT 'NEW' NOT NULL,
    reviewed_by        VARCHAR2(128),
    reviewed_at        TIMESTAMP,
    created_at         TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system      VARCHAR2(64) NOT NULL,
    etl_run_id         NUMBER(20) NOT NULL,
    CONSTRAINT UK_OPP_GUID UNIQUE (external_guid),
    CONSTRAINT FK_OPP_CUSTOMER FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT FK_OPP_BILLING FOREIGN KEY (billing_id) REFERENCES BILLING_RECORDS(billing_id),
    CONSTRAINT FK_OPP_ORIGIN_BU FOREIGN KEY (origin_bu_id) REFERENCES BUSINESS_UNITS(bu_id),
    CONSTRAINT FK_OPP_TARGET_BU FOREIGN KEY (target_bu_id) REFERENCES BUSINESS_UNITS(bu_id),
    CONSTRAINT FK_OPP_CATALOG FOREIGN KEY (catalog_id) REFERENCES PRODUCT_CATALOG(catalog_id),
    CONSTRAINT CHK_OPPORTUNITY_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    ),
    CONSTRAINT CHK_OPP_STATUS CHECK (
        status IN ('NEW', 'ACCEPTED', 'IN_PROGRESS', 'IN_CAMPAIGN', 'QUALIFIED', 'REJECTED', 'CLOSED_WON', 'CLOSED_LOST')
    ), -- Valores corresponden a STATUS_CATALOG.status_code WHERE entity_name = 'OPPORTUNITY'
    CONSTRAINT CHK_OPP_PRIORITY_RANGE CHECK (
        priority_score IS NULL OR (priority_score >= 0 AND priority_score <= 100)
    ),
    CONSTRAINT CHK_OPP_POTENTIAL_NONNEG CHECK (
        potential_amount IS NULL OR potential_amount >= 0
    )
);

-- 3.11 CROSS_SELL_EXCLUSIONS
CREATE TABLE CROSS_SELL_EXCLUSIONS (
    exclusion_id   NUMBER(10) PRIMARY KEY,
    external_guid  VARCHAR2(36) NOT NULL,
    customer_id    NUMBER(10),
    cnae_id        NUMBER(10),
    bu_id          NUMBER(10),
    exclusion_type VARCHAR2(32) DEFAULT 'PERMANENT' NOT NULL,
    reason         VARCHAR2(500) NOT NULL,
    valid_from     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    valid_to       TIMESTAMP,
    created_at     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system  VARCHAR2(64) NOT NULL,
    etl_run_id     NUMBER(20) NOT NULL,
    CONSTRAINT UK_EXCLUSION_GUID UNIQUE (external_guid),
    CONSTRAINT FK_EXCL_CUSTOMER FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT FK_EXCL_CNAE FOREIGN KEY (cnae_id) REFERENCES CNAE_CATALOG(cnae_id),
    CONSTRAINT FK_EXCL_BU FOREIGN KEY (bu_id) REFERENCES BUSINESS_UNITS(bu_id),
    CONSTRAINT CHK_EXCL_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    ),
    CONSTRAINT CHK_EXCL_TYPE CHECK (exclusion_type IN ('PERMANENT', 'TEMPORARY', 'MARKETING_ONLY')) -- Valores corresponden a STATUS_CATALOG.status_code WHERE entity_name = 'EXCLUSION'
);

-- 3.12 IDENTITY & ACCESS MANAGEMENT (IAM)

CREATE TABLE APP_USERS (
    user_id       NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    username      VARCHAR2(128) NOT NULL,
    user_type     VARCHAR2(16) DEFAULT 'LOCAL' NOT NULL,
    full_name     VARCHAR2(255) NOT NULL,
    email         VARCHAR2(255),
    is_active     CHAR(1) DEFAULT 'Y' NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT UK_USER_GUID UNIQUE (external_guid),
    CONSTRAINT UK_USER_NAME UNIQUE (username),
    CONSTRAINT CHK_USER_TYPE CHECK (user_type IN ('AD', 'LOCAL')),
    CONSTRAINT CHK_USER_ACTIVE CHECK (is_active IN ('Y', 'N')),
    CONSTRAINT CHK_USER_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

CREATE TABLE APP_ROLES (
    role_id   NUMBER(10) PRIMARY KEY,
    role_name VARCHAR2(64) NOT NULL,
    description VARCHAR2(255),
    CONSTRAINT UK_ROLE_NAME UNIQUE (role_name)
);

CREATE TABLE APP_PERMISSIONS (
    permission_id   NUMBER(10) PRIMARY KEY,
    permission_code VARCHAR2(64) NOT NULL,
    description     VARCHAR2(255),
    CONSTRAINT UK_PERM_CODE UNIQUE (permission_code)
);

CREATE TABLE APP_USER_ROLES (
    user_id NUMBER(10) NOT NULL,
    role_id NUMBER(10) NOT NULL,
    bu_id   NUMBER(10) NOT NULL,
    PRIMARY KEY (user_id, role_id, bu_id),
    CONSTRAINT FK_UR_USER FOREIGN KEY (user_id) REFERENCES APP_USERS(user_id),
    CONSTRAINT FK_UR_ROLE FOREIGN KEY (role_id) REFERENCES APP_ROLES(role_id),
    CONSTRAINT FK_UR_BU   FOREIGN KEY (bu_id)   REFERENCES BUSINESS_UNITS(bu_id)
);

CREATE TABLE APP_ROLE_PERMISSIONS (
    role_id       NUMBER(10) NOT NULL,
    permission_id NUMBER(10) NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT FK_RP_ROLE FOREIGN KEY (role_id) REFERENCES APP_ROLES(role_id),
    CONSTRAINT FK_RP_PERM FOREIGN KEY (permission_id) REFERENCES APP_PERMISSIONS(permission_id)
);

-- 3.13 COMMERCIAL CAMPAIGNS

CREATE TABLE COMMERCIAL_CAMPAIGNS (
    campaign_id   NUMBER(10) PRIMARY KEY,
    external_guid VARCHAR2(36) NOT NULL,
    campaign_name VARCHAR2(255) NOT NULL,
    origin_bu_id  NUMBER(10) NOT NULL,
    created_by    NUMBER(10) NOT NULL,
    description   VARCHAR2(1000),
    start_date    DATE,
    end_date      DATE,
    status        VARCHAR2(32) DEFAULT 'DRAFT' NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_CAMPAIGN_GUID UNIQUE (external_guid),
    CONSTRAINT FK_CAMP_BU FOREIGN KEY (origin_bu_id) REFERENCES BUSINESS_UNITS(bu_id),
    CONSTRAINT FK_CAMP_USER FOREIGN KEY (created_by) REFERENCES APP_USERS(user_id),
    CONSTRAINT CHK_CAMP_STATUS CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')), -- Valores corresponden a STATUS_CATALOG.status_code WHERE entity_name = 'CAMPAIGN'
    CONSTRAINT CHK_CAMP_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);

CREATE TABLE CAMPAIGN_TARGETS (
    target_id      NUMBER(10) PRIMARY KEY,
    external_guid  VARCHAR2(36) NOT NULL,
    campaign_id    NUMBER(10) NOT NULL,
    customer_id    NUMBER(10) NOT NULL,
    opportunity_id NUMBER(10),
    status         VARCHAR2(32) DEFAULT 'PENDING' NOT NULL,
    contact_date   DATE,
    notes          VARCHAR2(4000),
    created_at     TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT UK_TARGET_GUID UNIQUE (external_guid),
    CONSTRAINT UK_TARGET_COLLISION UNIQUE (campaign_id, customer_id),
    CONSTRAINT FK_TGT_CAMP FOREIGN KEY (campaign_id) REFERENCES COMMERCIAL_CAMPAIGNS(campaign_id),
    CONSTRAINT FK_TGT_CUST FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT FK_TGT_OPP FOREIGN KEY (opportunity_id) REFERENCES CROSS_SELL_OPPORTUNITIES(opportunity_id),
    CONSTRAINT CHK_TGT_STATUS CHECK (status IN ('PENDING', 'CONTACTED', 'CONVERTED', 'REJECTED')), -- Valores corresponden a STATUS_CATALOG.status_code WHERE entity_name = 'TARGET'
    CONSTRAINT CHK_TGT_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    )
);


-- 4. AUTOMATIC PK & GUID TRIGGERS
CREATE OR REPLACE TRIGGER TRG_HOLDING_AUTO
BEFORE INSERT ON CORPORATE_HOLDINGS FOR EACH ROW
BEGIN
  IF :NEW.holding_id IS NULL THEN
    SELECT SEQ_HOLDING_ID.NEXTVAL INTO :NEW.holding_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_BU_AUTO
BEFORE INSERT ON BUSINESS_UNITS FOR EACH ROW
BEGIN
  IF :NEW.bu_id IS NULL THEN
    SELECT SEQ_BU_ID.NEXTVAL INTO :NEW.bu_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_CATALOG_AUTO
BEFORE INSERT ON PRODUCT_CATALOG FOR EACH ROW
BEGIN
  IF :NEW.catalog_id IS NULL THEN
    SELECT SEQ_CATALOG_ID.NEXTVAL INTO :NEW.catalog_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_CUSTOMER_AUTO
BEFORE INSERT ON CUSTOMER_MASTER FOR EACH ROW
BEGIN
  IF :NEW.customer_id IS NULL THEN
    SELECT SEQ_CUSTOMER_ID.NEXTVAL INTO :NEW.customer_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_ADDRESS_AUTO
BEFORE INSERT ON ADDRESSES FOR EACH ROW
BEGIN
  IF :NEW.address_id IS NULL THEN
    SELECT SEQ_ADDRESS_ID.NEXTVAL INTO :NEW.address_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_CONTACT_AUTO
BEFORE INSERT ON CONTACTS FOR EACH ROW
BEGIN
  IF :NEW.contact_id IS NULL THEN
    SELECT SEQ_CONTACT_ID.NEXTVAL INTO :NEW.contact_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_CNAE_AUTO
BEFORE INSERT ON CNAE_CATALOG FOR EACH ROW
BEGIN
  IF :NEW.cnae_id IS NULL THEN
    SELECT SEQ_CNAE_ID.NEXTVAL INTO :NEW.cnae_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_CUSTOMER_CNAE_AUTO
BEFORE INSERT ON CUSTOMER_CNAE FOR EACH ROW
BEGIN
  IF :NEW.customer_cnae_id IS NULL THEN
    SELECT SEQ_CUSTOMER_CNAE_ID.NEXTVAL INTO :NEW.customer_cnae_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_BILLING_AUTO
BEFORE INSERT ON BILLING_RECORDS FOR EACH ROW
BEGIN
  IF :NEW.billing_id IS NULL THEN
    SELECT SEQ_BILLING_ID.NEXTVAL INTO :NEW.billing_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_OPPORTUNITY_AUTO
BEFORE INSERT ON CROSS_SELL_OPPORTUNITIES FOR EACH ROW
BEGIN
  IF :NEW.opportunity_id IS NULL THEN
    SELECT SEQ_OPPORTUNITY_ID.NEXTVAL INTO :NEW.opportunity_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_EXCLUSION_AUTO
BEFORE INSERT ON CROSS_SELL_EXCLUSIONS FOR EACH ROW
BEGIN
  IF :NEW.exclusion_id IS NULL THEN
    SELECT SEQ_EXCLUSION_ID.NEXTVAL INTO :NEW.exclusion_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_USER_AUTO
BEFORE INSERT ON APP_USERS FOR EACH ROW
BEGIN
  IF :NEW.user_id IS NULL THEN
    SELECT SEQ_USER_ID.NEXTVAL INTO :NEW.user_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_ROLE_AUTO
BEFORE INSERT ON APP_ROLES FOR EACH ROW
BEGIN
  IF :NEW.role_id IS NULL THEN
    SELECT SEQ_ROLE_ID.NEXTVAL INTO :NEW.role_id FROM DUAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_PERMISSION_AUTO
BEFORE INSERT ON APP_PERMISSIONS FOR EACH ROW
BEGIN
  IF :NEW.permission_id IS NULL THEN
    SELECT SEQ_PERMISSION_ID.NEXTVAL INTO :NEW.permission_id FROM DUAL;
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_CAMPAIGN_AUTO
BEFORE INSERT ON COMMERCIAL_CAMPAIGNS FOR EACH ROW
BEGIN
  IF :NEW.campaign_id IS NULL THEN
    SELECT SEQ_CAMPAIGN_ID.NEXTVAL INTO :NEW.campaign_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_TARGET_AUTO
BEFORE INSERT ON CAMPAIGN_TARGETS FOR EACH ROW
BEGIN
  IF :NEW.target_id IS NULL THEN
    SELECT SEQ_TARGET_ID.NEXTVAL INTO :NEW.target_id FROM DUAL;
  END IF;
  IF :NEW.external_guid IS NULL THEN
    :NEW.external_guid := LOWER(REGEXP_REPLACE(SYS_GUID(), '([A-F0-9]{8})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{4})([A-F0-9]{12})', '\1-\2-\3-\4-\5'));
  END IF;
END;
/

-- 5. METADATA COMMENTS
COMMENT ON TABLE CORPORATE_HOLDINGS IS 'Agrupaciones corporativas y holdings de grandes cuentas.';
COMMENT ON COLUMN CORPORATE_HOLDINGS.holding_id IS 'ID interno autogenerado.';
COMMENT ON COLUMN CORPORATE_HOLDINGS.external_guid IS 'UUID para integración externa.';
COMMENT ON COLUMN CORPORATE_HOLDINGS.holding_name IS 'Nombre del grupo empresarial.';

COMMENT ON TABLE BUSINESS_UNITS IS 'Entidades legales o líneas de negocio de TÜV SÜD.';
COMMENT ON COLUMN BUSINESS_UNITS.bu_id IS 'ID interno autogenerado.';
COMMENT ON COLUMN BUSINESS_UNITS.sap_code IS 'Código identificador en SAP.';
COMMENT ON COLUMN BUSINESS_UNITS.bu_name IS 'Nombre funcional de la BU.';

COMMENT ON TABLE PRODUCT_CATALOG IS 'Catálogo corporativo de productos y servicios.';
COMMENT ON COLUMN PRODUCT_CATALOG.material_code IS 'Código material o servicio origen.';
COMMENT ON COLUMN PRODUCT_CATALOG.category IS 'Categoría o familia comercial.';

COMMENT ON TABLE CUSTOMER_MASTER IS 'Registro maestro de clientes unificado por identificador fiscal.';
COMMENT ON COLUMN CUSTOMER_MASTER.customer_id IS 'ID interno autogenerado.';
COMMENT ON COLUMN CUSTOMER_MASTER.tax_id IS 'CIF, NIF o identificador fiscal equivalente.';
COMMENT ON COLUMN CUSTOMER_MASTER.legal_name IS 'Razón social del cliente.';
COMMENT ON COLUMN CUSTOMER_MASTER.holding_id IS 'Holding al que pertenece el cliente, si aplica.';

COMMENT ON TABLE ADDRESSES IS 'Ubicaciones operativas o direcciones asociadas al cliente.';
COMMENT ON COLUMN ADDRESSES.full_address IS 'Dirección completa del centro o sede.';

COMMENT ON TABLE CONTACTS IS 'Personas físicas de contacto asociadas a clientes y protegidas por RGPD.';
COMMENT ON COLUMN CONTACTS.bu_id IS 'BU responsable de la soberanía del dato y privacidad.';

COMMENT ON TABLE CNAE_CATALOG IS 'Tabla maestra de CNAEs para clasificación sectorial.';
COMMENT ON COLUMN CNAE_CATALOG.cnae_code IS 'Código CNAE.';
COMMENT ON COLUMN CNAE_CATALOG.cnae_name IS 'Descripción del CNAE.';
COMMENT ON COLUMN CNAE_CATALOG.cnae_level IS 'Nivel jerárquico o agrupación sectorial del CNAE.';

COMMENT ON TABLE CUSTOMER_CNAE IS 'Relación entre clientes y CNAEs.';
COMMENT ON COLUMN CUSTOMER_CNAE.is_primary IS 'Marca si el CNAE es principal (Y) o secundario (N).';

COMMENT ON TABLE BILLING_RECORDS IS 'Histórico comercial y de facturación por cliente, BU y servicio.';
COMMENT ON COLUMN BILLING_RECORDS.invoice_number IS 'Número de factura o documento de billing.';
COMMENT ON COLUMN BILLING_RECORDS.invoice_amount IS 'Importe de la factura.';
COMMENT ON COLUMN BILLING_RECORDS.invoice_date IS 'Fecha de la factura.';
COMMENT ON COLUMN BILLING_RECORDS.invoice_description IS 'Descripción comercial o detalle relevante de la factura.';
COMMENT ON COLUMN BILLING_RECORDS.currency_code IS 'Código ISO de moneda.';
COMMENT ON COLUMN BILLING_RECORDS.expiry_date IS 'Fecha de caducidad o renovación esperada del servicio.';
COMMENT ON COLUMN BILLING_RECORDS.service_start_date IS 'Fecha de inicio del servicio, si aplica.';
COMMENT ON COLUMN BILLING_RECORDS.service_end_date IS 'Fecha de fin del servicio, si aplica.';

COMMENT ON TABLE CROSS_SELL_OPPORTUNITIES IS 'Alertas comerciales generadas por inteligencia de datos.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.customer_id IS 'Cliente sobre el que se genera la oportunidad.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.billing_id IS 'Registro de facturación origen si la oportunidad deriva de una contratación concreta.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.origin_bu_id IS 'BU actual u origen desde la que se detecta la oportunidad.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.target_bu_id IS 'BU objetivo a la que se propone la acción comercial.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.catalog_id IS 'Servicio o producto sugerido.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.opportunity_reason IS 'Motivo funcional de la recomendación.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.priority_score IS 'Puntuación de prioridad de 0 a 100.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.potential_amount IS 'Potencial económico estimado.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.status IS 'Estado de la oportunidad.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.reviewed_by IS 'Usuario o proceso que revisó la oportunidad.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.reviewed_at IS 'Fecha de revisión de la oportunidad.';

COMMENT ON TABLE CROSS_SELL_EXCLUSIONS IS 'Reglas de exclusión e incompatibilidades comerciales por cliente o sector.';
COMMENT ON COLUMN CROSS_SELL_EXCLUSIONS.exclusion_type IS 'Tipo de exclusión (PERMANENTE, TEMPORAL, etc).';
COMMENT ON COLUMN CROSS_SELL_EXCLUSIONS.reason IS 'Motivo funcional del bloqueo comercial.';
COMMENT ON COLUMN CROSS_SELL_EXCLUSIONS.valid_from IS 'Fecha de inicio de la vigencia de la exclusión.';
COMMENT ON COLUMN CROSS_SELL_EXCLUSIONS.valid_to IS 'Fecha de fin de la vigencia (NULL si es indefinida).';

COMMENT ON TABLE APP_USERS IS 'Maestro unificado de usuarios de la aplicación (AD y Locales).';
COMMENT ON COLUMN APP_USERS.user_type IS 'Discriminador de origen: AD (Active Directory) o LOCAL.';
COMMENT ON COLUMN APP_USERS.is_active IS 'Estado del usuario para baja lógica (Y/N).';

COMMENT ON TABLE APP_ROLES IS 'Perfiles funcionales de acceso.';
COMMENT ON TABLE APP_PERMISSIONS IS 'Acciones granulares permitidas en el sistema.';
COMMENT ON COLUMN APP_USER_ROLES.bu_id IS 'Unidad de Negocio sobre la que el usuario ejerce el rol.';

COMMENT ON TABLE COMMERCIAL_CAMPAIGNS IS 'Definición de campañas comerciales y trazabilidad de origen.';
COMMENT ON COLUMN COMMERCIAL_CAMPAIGNS.origin_bu_id IS 'BU que lanza y es propietaria de la campaña.';
COMMENT ON COLUMN COMMERCIAL_CAMPAIGNS.status IS 'Estado del ciclo de vida de la campaña.';

COMMENT ON TABLE CAMPAIGN_TARGETS IS 'Relación de clientes impactados por una campaña para evitar duplicidad.';
COMMENT ON COLUMN CAMPAIGN_TARGETS.status IS 'Estado de gestión del contacto comercial.';
COMMENT ON COLUMN CAMPAIGN_TARGETS.contact_date IS 'Fecha efectiva del contacto con el cliente.';

COMMENT ON TABLE STATUS_CATALOG IS 'Catálogo maestro de estados y tipos del sistema. Tabla de referencia para la capa de aplicación.';
COMMENT ON COLUMN STATUS_CATALOG.entity_name IS 'Entidad del modelo a la que aplica el estado (OPPORTUNITY, CAMPAIGN, TARGET, EXCLUSION).';
COMMENT ON COLUMN STATUS_CATALOG.status_code IS 'Código técnico del estado, coincide con el valor almacenado en las tablas operativas.';
COMMENT ON COLUMN STATUS_CATALOG.status_name IS 'Nombre legible para la interfaz de usuario.';
COMMENT ON COLUMN STATUS_CATALOG.display_order IS 'Orden de presentación en la interfaz.';
COMMENT ON COLUMN STATUS_CATALOG.is_active IS 'Permite desactivar un estado sin borrarlo (Y/N).';

-- Global Audit Comments
COMMENT ON COLUMN CUSTOMER_MASTER.created_at IS 'Fecha y hora de inserción en el sistema Focus.';
COMMENT ON COLUMN CUSTOMER_MASTER.source_system IS 'Sistema origen del dato (CRM, SAP, EXCEL, etc.).';
COMMENT ON COLUMN CUSTOMER_MASTER.etl_run_id IS 'ID del proceso técnico de carga ETL.';
