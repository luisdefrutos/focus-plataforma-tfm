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
        'CUSTOMER_CNAE',
        'CNAE_CATALOG',
        'CROSS_SELL_OPPORTUNITIES',
        'BILLING_RECORDS',
        'CONTACTS',
        'ADDRESSES',
        'CUSTOMER_MASTER',
        'PRODUCT_CATALOG',
        'BUSINESS_UNITS',
        'CORPORATE_HOLDINGS'
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
        'SEQ_CNAE_ID',
        'SEQ_CUSTOMER_CNAE_ID',
        'SEQ_BILLING_ID',
        'SEQ_OPPORTUNITY_ID'
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

-- 3. CREATE TABLES

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
    owning_bu_id  NUMBER(10) NOT NULL,
    full_name     VARCHAR2(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    source_system VARCHAR2(64) NOT NULL,
    etl_run_id    NUMBER(20) NOT NULL,
    CONSTRAINT UK_CONTACT_GUID UNIQUE (external_guid),
    CONSTRAINT FK_CON_CUSTOMER FOREIGN KEY (customer_id) REFERENCES CUSTOMER_MASTER(customer_id),
    CONSTRAINT FK_CON_BU FOREIGN KEY (owning_bu_id) REFERENCES BUSINESS_UNITS(bu_id),
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
    suggested_cat_id   NUMBER(10) NOT NULL,
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
    CONSTRAINT FK_OPP_CATALOG FOREIGN KEY (suggested_cat_id) REFERENCES PRODUCT_CATALOG(catalog_id),
    CONSTRAINT CHK_OPPORTUNITY_GUID_FMT CHECK (
        REGEXP_LIKE(external_guid, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'i')
    ),
    CONSTRAINT CHK_OPP_STATUS CHECK (
        status IN ('NEW', 'IN_PROGRESS', 'QUALIFIED', 'REJECTED', 'CLOSED_WON', 'CLOSED_LOST')
    ),
    CONSTRAINT CHK_OPP_PRIORITY_RANGE CHECK (
        priority_score IS NULL OR (priority_score >= 0 AND priority_score <= 100)
    ),
    CONSTRAINT CHK_OPP_POTENTIAL_NONNEG CHECK (
        potential_amount IS NULL OR potential_amount >= 0
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
COMMENT ON COLUMN CONTACTS.owning_bu_id IS 'BU responsable de la soberanía del dato y privacidad.';

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
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.suggested_cat_id IS 'Servicio o producto sugerido.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.opportunity_reason IS 'Motivo funcional de la recomendación.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.priority_score IS 'Puntuación de prioridad de 0 a 100.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.potential_amount IS 'Potencial económico estimado.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.status IS 'Estado de la oportunidad.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.reviewed_by IS 'Usuario o proceso que revisó la oportunidad.';
COMMENT ON COLUMN CROSS_SELL_OPPORTUNITIES.reviewed_at IS 'Fecha de revisión de la oportunidad.';

-- Global Audit Comments
COMMENT ON COLUMN CUSTOMER_MASTER.created_at IS 'Fecha y hora de inserción en el sistema Focus.';
COMMENT ON COLUMN CUSTOMER_MASTER.source_system IS 'Sistema origen del dato (CRM, SAP, EXCEL, etc.).';
COMMENT ON COLUMN CUSTOMER_MASTER.etl_run_id IS 'ID del proceso técnico de carga ETL.';
