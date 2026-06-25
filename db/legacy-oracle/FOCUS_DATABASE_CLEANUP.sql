/*
  ==============================================================================
  PROJECT FOCUS - SAFE DATABASE CLEANUP SCRIPT
  ==============================================================================
  Author: Coding Assistant
  Date: 2026-04-15
  Purpose: Completely reset the Project Focus schema by dropping all 
           tables and sequences created during the setup.
  Strategy: Safe PL/SQL blocks (Checks existence before dropping).
  ==============================================================================
*/

-- RESUMEN: Este script borra TODA la estructura del Proyecto Focus.
-- Úselo con precaución en entornos de desarrollo/pruebas.

SET SERVEROUTPUT ON;

BEGIN
    DBMS_OUTPUT.PUT_LINE('Iniciando limpieza del esquema Focus...');

    -- 1. DROP TABLES (In correct order for constraints)
    FOR i IN (SELECT table_name FROM user_tables WHERE table_name IN (
        'CROSS_SELL_OPPORTUNITIES', 'BILLING_RECORDS', 'CONTACTS', 'ADDRESSES', 
        'CUSTOMER_MASTER', 'PRODUCT_CATALOG', 'BUSINESS_UNITS', 'CORPORATE_HOLDINGS'
    )) LOOP
        DBMS_OUTPUT.PUT_LINE('Borrando Tabla: ' || i.table_name);
        EXECUTE IMMEDIATE 'DROP TABLE ' || i.table_name || ' CASCADE CONSTRAINTS';
    END LOOP;

    -- 2. DROP SEQUENCES
    FOR i IN (SELECT sequence_name FROM user_sequences WHERE sequence_name IN (
        'SEQ_HOLDING_ID', 'SEQ_BU_ID', 'SEQ_CUSTOMER_ID', 'SEQ_ADDRESS_ID', 
        'SEQ_CONTACT_ID', 'SEQ_BILLING_ID', 'SEQ_CATALOG_ID', 'SEQ_OPPORTUNITY_ID'
    )) LOOP
        DBMS_OUTPUT.PUT_LINE('Borrando Secuencia: ' || i.sequence_name);
        EXECUTE IMMEDIATE 'DROP SEQUENCE ' || i.sequence_name;
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('Limpieza completada con éxito.');
END;
/

-- COMMIT opcional si se requiere persistencia en la sesión actual
-- COMMIT;
