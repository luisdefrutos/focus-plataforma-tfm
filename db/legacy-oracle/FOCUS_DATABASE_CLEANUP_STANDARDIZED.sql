/*
  ==============================================================================
  PROJECT FOCUS - SAFE DATABASE CLEANUP SCRIPT (STANDARDIZED MODEL)
  ==============================================================================
  Author: Coding Assistant
  Date: 2026-04-16
  Purpose: Completely reset the Project Focus STANDARDIZED schema by dropping
           all tables and sequences created during the setup, including
           IAM, Exclusions and Campaign modules.
  Strategy: Safe PL/SQL blocks (Checks existence before dropping).
  
  ==============================================================================
*/

-- RESUMEN: Este script borra TODA la estructura del Proyecto Focus (modelo ampliado).
-- Incluye las 19 tablas y 17 secuencias del modelo estandarizado.
-- Úselo con precaución en entornos de desarrollo/pruebas.

SET SERVEROUTPUT ON;

BEGIN
    DBMS_OUTPUT.PUT_LINE('Iniciando limpieza del esquema Focus Standardized...');

    -- 1. DROP TABLES (In correct dependency order: children first, parents last)
    FOR i IN (SELECT table_name FROM user_tables WHERE table_name IN (
        -- Campañas (dependen de IAM y Golden Record)
        'CAMPAIGN_TARGETS',
        'COMMERCIAL_CAMPAIGNS',
        -- IAM (tablas de relación primero)
        'APP_ROLE_PERMISSIONS',
        'APP_USER_ROLES',
        'APP_PERMISSIONS',
        'APP_ROLES',
        'APP_USERS',
        -- Exclusiones
        'CROSS_SELL_EXCLUSIONS',
        -- Motor Comercial
        'CROSS_SELL_OPPORTUNITIES',
        'BILLING_RECORDS',
        -- Clasificación Sectorial
        'CUSTOMER_CNAE',
        'CNAE_CATALOG',
        -- Golden Record (hijas primero)
        'CONTACTS',
        'ADDRESSES',
        'CUSTOMER_MASTER',
        'PRODUCT_CATALOG',
        'BUSINESS_UNITS',
        'CORPORATE_HOLDINGS',
        -- Catálogo de Estados
        'STATUS_CATALOG'
    )) LOOP
        DBMS_OUTPUT.PUT_LINE('Borrando Tabla: ' || i.table_name);
        EXECUTE IMMEDIATE 'DROP TABLE ' || i.table_name || ' CASCADE CONSTRAINTS';
    END LOOP;

    -- 2. DROP SEQUENCES
    FOR i IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN (
        -- Golden Record
        'SEQ_HOLDING_ID',
        'SEQ_BU_ID',
        'SEQ_CATALOG_ID',
        'SEQ_CUSTOMER_ID',
        'SEQ_ADDRESS_ID',
        'SEQ_CONTACT_ID',
        -- Clasificación Sectorial
        'SEQ_CNAE_ID',
        'SEQ_CUSTOMER_CNAE_ID',
        -- Motor Comercial
        'SEQ_BILLING_ID',
        'SEQ_OPPORTUNITY_ID',
        -- Exclusiones
        'SEQ_EXCLUSION_ID',
        -- IAM
        'SEQ_USER_ID',
        'SEQ_ROLE_ID',
        'SEQ_PERMISSION_ID',
        -- Campañas
        'SEQ_CAMPAIGN_ID',
        'SEQ_TARGET_ID',
        -- Catálogo de Estados
        'SEQ_STATUS_ID'
    )) LOOP
        DBMS_OUTPUT.PUT_LINE('Borrando Secuencia: ' || i.sequence_name);
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || i.sequence_name;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('Limpieza completada con éxito. Total: 19 tablas y 17 secuencias procesadas.');
END;
/

-- COMMIT opcional si se requiere persistencia en la sesión actual
-- COMMIT;
