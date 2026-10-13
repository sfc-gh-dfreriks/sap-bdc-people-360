-- =====================================================================
-- SAP People 360 Native App — SELF-CONTAINED setup script
-- Data is bundled in the package (SHARED_DATA). No consumer references.
-- Powers the SAP_PEOPLE_360_ANALYTICS Cortex Analyst semantic view (the
-- same model behind the account-level SAP_PEOPLE_ANALYST agent).
-- =====================================================================

CREATE APPLICATION ROLE IF NOT EXISTS app_public;

-- config schema: settings consumed by the container (e.g. semantic view)
CREATE SCHEMA IF NOT EXISTS config;
GRANT USAGE ON SCHEMA config TO APPLICATION ROLE app_public;
CREATE TABLE IF NOT EXISTS config.settings(key STRING, value STRING);

-- app_data schema: views over the bundled data + Cortex Analyst semantic view
CREATE SCHEMA IF NOT EXISTS app_data;
GRANT USAGE ON SCHEMA app_data TO APPLICATION ROLE app_public;

CREATE OR REPLACE VIEW app_data.DT_WORKFORCE_360 AS SELECT * FROM shared_data.DT_WORKFORCE_360;
GRANT SELECT ON VIEW app_data.DT_WORKFORCE_360 TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_PERFORMANCE AS SELECT * FROM shared_data.DT_PERFORMANCE;
GRANT SELECT ON VIEW app_data.DT_PERFORMANCE TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_LEARNING AS SELECT * FROM shared_data.DT_LEARNING;
GRANT SELECT ON VIEW app_data.DT_LEARNING TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.DT_RECRUITING AS SELECT * FROM shared_data.DT_RECRUITING;
GRANT SELECT ON VIEW app_data.DT_RECRUITING TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.LINEAGE_COUNTS AS SELECT * FROM shared_data.LINEAGE_COUNTS;
GRANT SELECT ON VIEW app_data.LINEAGE_COUNTS TO APPLICATION ROLE app_public;

-- HR onboarding scenario: bundled reference data (demo enrichment, not SAP).
CREATE OR REPLACE VIEW app_data.BENEFITS_PLAN AS SELECT * FROM shared_data.BENEFITS_PLAN;
GRANT SELECT ON VIEW app_data.BENEFITS_PLAN TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.EQUIPMENT_KIT AS SELECT * FROM shared_data.EQUIPMENT_KIT;
GRANT SELECT ON VIEW app_data.EQUIPMENT_KIT TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.IT_INVENTORY AS SELECT * FROM shared_data.IT_INVENTORY;
GRANT SELECT ON VIEW app_data.IT_INVENTORY TO APPLICATION ROLE app_public;
CREATE OR REPLACE VIEW app_data.PREFERRED_SOURCING AS SELECT * FROM shared_data.PREFERRED_SOURCING;
GRANT SELECT ON VIEW app_data.PREFERRED_SOURCING TO APPLICATION ROLE app_public;

-- onboarding schema (non-versioned, so rows survive upgrades): SIMULATED SuccessFactors write-back.
CREATE SCHEMA IF NOT EXISTS onboarding;
GRANT USAGE ON SCHEMA onboarding TO APPLICATION ROLE app_public;
CREATE TABLE IF NOT EXISTS onboarding.SF_WRITEBACK_EMPHIRE (
  REQUEST_ID VARCHAR, PERSON_ID_EXTERNAL VARCHAR, CANDIDATE_NAME VARCHAR, JOB_TITLE VARCHAR, DEPARTMENT VARCHAR, COMPANY VARCHAR,
  PAY_GRADE NUMBER(38,0), ANNUAL_SALARY NUMBER(14,2), CURRENCY VARCHAR, START_DATE DATE, ODATA_PAYLOAD VARIANT, STATUS VARCHAR,
  CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP())
  COMMENT = 'SIMULATED write-back to SuccessFactors EC (EmpJob/EmpCompensation/PerPerson)';
CREATE TABLE IF NOT EXISTS onboarding.SF_WRITEBACK_EQUIPMENT_REQUEST (
  REQUEST_ID VARCHAR, LINE_NO NUMBER(38,0), ITEM_CODE VARCHAR, ITEM_NAME VARCHAR, QUANTITY NUMBER(38,0), FULFILLMENT VARCHAR,
  SUPPLIER VARCHAR, UNIT_COST NUMBER(14,2), CURRENCY VARCHAR, EXPECTED_DATE DATE, STATUS VARCHAR, CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP())
  COMMENT = 'SIMULATED onboarding equipment request lines';
CREATE TABLE IF NOT EXISTS onboarding.SOURCING_DECISION (
  REQUEST_ID VARCHAR, ITEM_CODE VARCHAR, PREFERRED VARIANT, ALTERNATIVES VARIANT, CHOSEN VARIANT, RATIONALE VARCHAR,
  CREATED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP())
  COMMENT = 'Audit of the substitution decision';
GRANT SELECT ON ALL TABLES IN SCHEMA onboarding TO APPLICATION ROLE app_public;

-- Semantic view for Cortex Analyst, built over the bundled APP_DATA views.
-- Mirrors SAP_PEOPLE_360.SEMANTIC.SAP_PEOPLE_360_ANALYTICS (SAP_PEOPLE_ANALYST).
create or replace semantic view app_data.SAP_PEOPLE_360_ANALYTICS
  tables (
    WORKFORCE as APP_DATA.DT_WORKFORCE_360 primary key (EMPLOYEE_ID) with synonyms=('employees','workforce','headcount','staff','people') comment='Employee-level workforce fact with org, demographics, compensation, tenure, movement.'
  )
  facts (
    WORKFORCE.HEADCOUNT as HEADCOUNT comment='1 for active employees at end of period.',
    WORKFORCE.TERMINATIONS as TERMINATIONS comment='1 if the employee was terminated.',
    WORKFORCE.EXTERNAL_HIRES as EXTERNAL_HIRES comment='1 if hired externally in the last year.',
    WORKFORCE.FTE as FTE comment='Full-time equivalent.',
    WORKFORCE.ANNUAL_SALARY as ANNUAL_SALARY with synonyms=('salary','pay','compensation') comment='Annual base salary.',
    WORKFORCE.COMPA_RATIO as COMPA_RATIO comment='Salary divided by pay-grade midpoint.',
    WORKFORCE.TENURE_YEARS as TENURE_YEARS comment='Years of organizational tenure.',
    WORKFORCE.DIRECT_REPORTS as DIRECT_REPORTS comment='Number of direct reports.'
  )
  dimensions (
    WORKFORCE.EMPLOYEE_ID as EMPLOYEE_ID with synonyms=('employee','worker id') comment='Employee identifier.',
    WORKFORCE.DEPARTMENT as DEPARTMENT with synonyms=('dept','function') comment='Department name.',
    WORKFORCE.DIVISION as DIVISION with synonyms=('region','business unit') comment='Division/region.',
    WORKFORCE.LOCATION as LOCATION with synonyms=('office','site') comment='Work location.',
    WORKFORCE.COMPANY as COMPANY with synonyms=('legal entity','company code') comment='Company/operating entity.',
    WORKFORCE.JOB_TITLE as JOB_TITLE with synonyms=('title','role') comment='Job title.',
    WORKFORCE.PAY_GRADE as PAY_GRADE comment='Pay grade level.',
    WORKFORCE.GENDER as GENDER comment='Gender.',
    WORKFORCE.GENERATION as GENERATION comment='Generational cohort.',
    WORKFORCE.AGE_BAND as AGE_BAND with synonyms=('age group') comment='Age band.',
    WORKFORCE.EMPLOYMENT_STATUS as EMPLOYMENT_STATUS with synonyms=('status','active') comment='Active or Terminated.',
    WORKFORCE.EMPLOYEE_TYPE as EMPLOYEE_TYPE comment='Regular or Contingent.',
    WORKFORCE.EMPLOYMENT_TYPE as EMPLOYMENT_TYPE comment='Full-Time or Part-Time.',
    WORKFORCE.IS_MANAGER as IS_MANAGER comment='True if a people manager.',
    WORKFORCE.IS_CRITICAL_POSITION as IS_CRITICAL_POSITION comment='True if a critical position.',
    WORKFORCE.TENURE_BAND as TENURE_BAND with synonyms=('tenure group') comment='Tenure band.',
    WORKFORCE.TERMINATION_REASON as TERMINATION_REASON comment='Reason for termination.',
    WORKFORCE.HIRE_YEAR as HIRE_YEAR comment='Year of hire.',
    WORKFORCE.CURRENCY as CURRENCY comment='Salary currency.'
  )
  comment='SAP People 360 workforce analytics: headcount, attrition, diversity, compensation, tenure (bundled with the Native App).';
GRANT SELECT ON SEMANTIC VIEW app_data.SAP_PEOPLE_360_ANALYTICS TO APPLICATION ROLE app_public;

-- Record the semantic view FQN for the container's Analyst page.
DELETE FROM config.settings WHERE key = 'semantic_view';
INSERT INTO config.settings(key, value)
  SELECT 'semantic_view', CURRENT_DATABASE() || '.APP_DATA.SAP_PEOPLE_360_ANALYTICS';

-- services schema (non-versioned): holds the SPCS service
CREATE SCHEMA IF NOT EXISTS services;
GRANT USAGE ON SCHEMA services TO APPLICATION ROLE app_public;

-- Onboarding scenario egress: web search + the retailer pages it returns. App-created EAI; usable once the
-- consumer approves the EXTERNAL_ACCESS app specification. HOST_PORTS must match the network rule exactly.
CREATE NETWORK RULE IF NOT EXISTS services.onboarding_web_rule
  TYPE = HOST_PORT MODE = EGRESS
  VALUE_LIST = ('html.duckduckgo.com', 'api.tavily.com', 'www.amazon.com', 'www.bestbuy.com', 'www.walmart.com', 'www.newegg.com', 'www.ebay.com', 'www.cdw.com', 'www.bhphotovideo.com', 'www.hp.com', 'www.dell.com', 'www.lenovo.com', 'www.microsoft.com', 'www.amazon.de', 'www.amazon.co.uk', 'www.amazon.fr', 'www.idealo.de', 'www.mediamarkt.de', 'www.notebooksbilliger.de', 'www.cyberport.de', 'www.amazon.co.jp', 'kakaku.com', 'www.yodobashi.com', 'www.biccamera.com');
ALTER NETWORK RULE services.onboarding_web_rule SET VALUE_LIST = ('html.duckduckgo.com', 'api.tavily.com', 'www.amazon.com', 'www.bestbuy.com', 'www.walmart.com', 'www.newegg.com', 'www.ebay.com', 'www.cdw.com', 'www.bhphotovideo.com', 'www.hp.com', 'www.dell.com', 'www.lenovo.com', 'www.microsoft.com', 'www.amazon.de', 'www.amazon.co.uk', 'www.amazon.fr', 'www.idealo.de', 'www.mediamarkt.de', 'www.notebooksbilliger.de', 'www.cyberport.de', 'www.amazon.co.jp', 'kakaku.com', 'www.yodobashi.com', 'www.biccamera.com');
CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS people_360_onboarding_web_eai
  ALLOWED_NETWORK_RULES = (services.onboarding_web_rule)
  ENABLED = TRUE;
ALTER APPLICATION SET SPECIFICATION onboarding_web_spec
  TYPE = EXTERNAL_ACCESS
  LABEL = 'Onboarding: web search for equipment alternatives'
  DESCRIPTION = 'When onboarding equipment is backordered, search the web and read retailer pages to find priced alternatives. No People data is sent.'
  HOST_PORTS = ('html.duckduckgo.com', 'api.tavily.com', 'www.amazon.com', 'www.bestbuy.com', 'www.walmart.com', 'www.newegg.com', 'www.ebay.com', 'www.cdw.com', 'www.bhphotovideo.com', 'www.hp.com', 'www.dell.com', 'www.lenovo.com', 'www.microsoft.com', 'www.amazon.de', 'www.amazon.co.uk', 'www.amazon.fr', 'www.idealo.de', 'www.mediamarkt.de', 'www.notebooksbilliger.de', 'www.cyberport.de', 'www.amazon.co.jp', 'kakaku.com', 'www.yodobashi.com', 'www.biccamera.com');

-- callbacks schema: app-specification approval restarts the service so the new egress applies
CREATE SCHEMA IF NOT EXISTS callbacks;
GRANT USAGE ON SCHEMA callbacks TO APPLICATION ROLE app_public;
CREATE OR REPLACE PROCEDURE callbacks.on_spec_approved_or_declined(name STRING, status STRING, payload STRING)
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$
BEGIN
  IF (:status = 'APPROVED') THEN
    BEGIN
      ALTER SERVICE services.people_360_service SET EXTERNAL_ACCESS_INTEGRATIONS = (people_360_onboarding_web_eai);
      ALTER SERVICE services.people_360_service SUSPEND;
    EXCEPTION WHEN OTHER THEN NULL;
    END;
    BEGIN
      ALTER SERVICE services.people_360_service RESUME;
      CALL SYSTEM$WAIT_FOR_SERVICES(600, 'services.people_360_service');
    EXCEPTION WHEN OTHER THEN NULL;
    END;
  END IF;
  RETURN 'on_spec_approved_or_declined: ' || :name || ' ' || :status;
END;
$$;
GRANT USAGE ON PROCEDURE callbacks.on_spec_approved_or_declined(STRING, STRING, STRING) TO APPLICATION ROLE app_public;

-- core schema (versioned): lifecycle + service management
CREATE OR ALTER VERSIONED SCHEMA core;
GRANT USAGE ON SCHEMA core TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.version_init()
  RETURNS STRING
  LANGUAGE SQL
  EXECUTE AS OWNER
AS $$
DECLARE
  pool_name VARCHAR;
  wh_name VARCHAR;
  svc_count INTEGER;
BEGIN
  pool_name := (SELECT CURRENT_DATABASE()) || '_POOL';
  wh_name   := (SELECT CURRENT_DATABASE()) || '_WH';

  CREATE COMPUTE POOL IF NOT EXISTS IDENTIFIER(:pool_name)
    MIN_NODES = 1 MAX_NODES = 1 INSTANCE_FAMILY = CPU_X64_XS
    AUTO_RESUME = TRUE AUTO_SUSPEND_SECS = 300;

  CREATE WAREHOUSE IF NOT EXISTS IDENTIFIER(:wh_name)
    WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE;

  SHOW SERVICES LIKE 'PEOPLE_360_SERVICE' IN SCHEMA services;
  svc_count := (SELECT COUNT(*) FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())));

  IF (:svc_count = 0) THEN
    CREATE SERVICE services.people_360_service
      IN COMPUTE POOL IDENTIFIER(:pool_name)
      FROM SPECIFICATION_FILE = '/service_spec.yml'
      EXTERNAL_ACCESS_INTEGRATIONS = (people_360_onboarding_web_eai)
      MIN_INSTANCES = 1 MAX_INSTANCES = 1;
    GRANT USAGE ON SERVICE services.people_360_service TO APPLICATION ROLE app_public;
    GRANT SERVICE ROLE services.people_360_service!people_360_role TO APPLICATION ROLE app_public;
  ELSE
    ALTER SERVICE services.people_360_service FROM SPECIFICATION_FILE = '/service_spec.yml';
    -- Egress for the onboarding scenario; harmless if the consumer has not approved the spec yet.
    BEGIN
      ALTER SERVICE services.people_360_service SET EXTERNAL_ACCESS_INTEGRATIONS = (people_360_onboarding_web_eai);
    EXCEPTION WHEN OTHER THEN NULL;
    END;
    CALL SYSTEM$WAIT_FOR_SERVICES(600, 'services.people_360_service');
  END IF;
  RETURN 'version_init ok';
END;
$$;
GRANT USAGE ON PROCEDURE core.version_init() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.suspend_service()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ BEGIN ALTER SERVICE services.people_360_service SUSPEND; RETURN 'Service suspended'; END; $$;
GRANT USAGE ON PROCEDURE core.suspend_service() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.resume_service()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ BEGIN ALTER SERVICE services.people_360_service RESUME; RETURN 'Service resumed'; END; $$;
GRANT USAGE ON PROCEDURE core.resume_service() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.get_service_status()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE status VARCHAR;
BEGIN CALL SYSTEM$GET_SERVICE_STATUS('services.people_360_service') INTO :status; RETURN :status; END; $$;
GRANT USAGE ON PROCEDURE core.get_service_status() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.get_service_logs(instance_id STRING, container_name STRING)
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE logs VARCHAR;
BEGIN CALL SYSTEM$GET_SERVICE_LOGS('services.people_360_service', :instance_id, :container_name, 200) INTO :logs; RETURN :logs; END; $$;
GRANT USAGE ON PROCEDURE core.get_service_logs(STRING, STRING) TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.app_url()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE url VARCHAR;
BEGIN
  SHOW ENDPOINTS IN SERVICE services.people_360_service;
  SELECT "ingress_url" INTO :url FROM TABLE(RESULT_SCAN(LAST_QUERY_ID())) WHERE "name" = 'people360';
  RETURN :url;
END; $$;
GRANT USAGE ON PROCEDURE core.app_url() TO APPLICATION ROLE app_public;

CREATE OR REPLACE PROCEDURE core.selftest()
  RETURNS STRING LANGUAGE SQL EXECUTE AS OWNER
AS $$ DECLARE wf INTEGER; perf INTEGER;
BEGIN
  SELECT COUNT(*) INTO :wf FROM app_data.DT_WORKFORCE_360;
  SELECT COUNT(*) INTO :perf FROM app_data.DT_PERFORMANCE;
  RETURN 'bundled data OK — DT_WORKFORCE_360=' || :wf || ' rows, DT_PERFORMANCE=' || :perf || ' rows';
END; $$;
GRANT USAGE ON PROCEDURE core.selftest() TO APPLICATION ROLE app_public;
