# Install & Deploy — SAP BDC People 360

Two paths: **A. Build the data platform** (L0→L1→L2→semantic→agent) for Snowflake
Intelligence, and/or **B. Deploy the self-contained Native App** and publish it as
an org listing across regions. B bundles its own data and does not require A in
the consumer account.

## Prerequisites
- Snowflake account with `ACCOUNTADMIN`
- SAP BDC Core Workforce data product mounted (`SAP_BDC_DEMO_CORE_WORKFORCE_DATA`)
- Docker + `snow` CLI + an image repository (e.g. `SC360_APP_PROVIDER.IMAGES.REPO`)
- Python 3.11+ with `snowflake-connector-python`, `cryptography`
- Key-pair connections in `~/.snowflake/connections.toml`

## A. Build the data platform
Run as `ACCOUNTADMIN`, in order:
```
sql/02_l1_curated_views.sql          -- L1 SAP_BDC_L1.WORKFORCE
sql/03_l2_analytics_dynamic_tables.sql  -- L2 ANALYTICS.* (needs a warehouse)
sql/04_semantic_view.sql             -- SAP_PEOPLE_360_ANALYTICS
sql/05_cortex_agent.sql              -- SAP_PEOPLE_ANALYST (grant SNOWFLAKE.CORTEX_USER first)
```
Verify + chat with `SAP_PEOPLE_ANALYST` in Snowflake Intelligence:
```sql
SELECT * FROM SEMANTIC_VIEW(
  SAP_PEOPLE_360.SEMANTIC.SAP_PEOPLE_360_ANALYTICS
  METRICS WORKFORCE.HEADCOUNT DIMENSIONS WORKFORCE.DEPARTMENT
);
```

## B. Deploy the Native App
Example connections: `dfreriksdemo` (US), `dfreriks_eu_demo` (EMEA), `dfreriks_apac_demo` (APAC).

1. **Build & push image** (once per region):
```bash
scripts/build_and_push.sh dfreriksdemo       sfsenorthamerica-dfreriks-aws1-w2.registry.snowflakecomputing.com
scripts/build_and_push.sh dfreriks_eu_demo   sfseeurope-dfreriks-eu-demo.registry.snowflakecomputing.com
scripts/build_and_push.sh dfreriks_apac_demo sfseapac-sap-data-product-demo.registry.snowflakecomputing.com
```
2. **Bundle data** (4 tables into `PEOPLE_360_PKG.SHARED_DATA`):
```bash
python scripts/migrate_data.py --target dfreriksdemo --mode local
python scripts/migrate_data.py --source dfreriksdemo --target dfreriks_eu_demo   --mode remote
python scripts/migrate_data.py --source dfreriksdemo --target dfreriks_apac_demo --mode remote
```
3. **Deploy app** (per account): stages artifacts, registers v1, creates `PEOPLE_360_APP`, inits service, prints URL:
```bash
python scripts/deploy_native_app.py --target dfreriksdemo
python scripts/deploy_native_app.py --target dfreriks_eu_demo
python scripts/deploy_native_app.py --target dfreriks_apac_demo
```
4. **Publish org listing** (region-scoped):
```bash
LISTING_CONTACT=you@snowflake.com python scripts/create_org_listing.py --target dfreriksdemo       --region PUBLIC.AWS_US_WEST_2
LISTING_CONTACT=you@snowflake.com python scripts/create_org_listing.py --target dfreriks_eu_demo   --region PUBLIC.AWS_EU_CENTRAL_1
LISTING_CONTACT=you@snowflake.com python scripts/create_org_listing.py --target dfreriks_apac_demo --region PUBLIC.AWS_AP_SOUTHEAST_2
```
Locator: `ORGDATACLOUD$INTERNAL$PEOPLE_360_ORG`.

## Native App internals
| Artifact | Purpose |
|----------|---------|
| `app/manifest.yml` | Manifest v2 (image, endpoint `people360`, privileges, version_initializer) |
| `app/setup.sql` | App roles, `APP_DATA` views over bundled `SHARED_DATA`, in-app `SAP_PEOPLE_360_ANALYTICS` semantic view, SPCS service + lifecycle procs |
| `app/service_spec.yml` | SPCS container/endpoint spec (`people360`, port 8080) |
| `app/snowflake.yml` | Snowflake CLI project (`PEOPLE_360_PKG` / `PEOPLE_360_APP`) |
| `service/app/` | React (Vite) client + Express server + Dockerfile |

## Onboarding scenario (Native App)

- Data: `migrate_data.py` bundles `BENEFITS_PLAN`, `EQUIPMENT_KIT`, `IT_INVENTORY`, `PREFERRED_SOURCING`
  (from `SAP_PEOPLE_360.ONBOARDING`); `setup.sql` exposes them as `APP_DATA` views.
- Write-back: `setup.sql` creates `SF_WRITEBACK_EMPHIRE`, `SF_WRITEBACK_EQUIPMENT_REQUEST`, `SOURCING_DECISION`
  in the app's **non-versioned** `ONBOARDING` schema (`CREATE TABLE IF NOT EXISTS`, so rows survive upgrades).
- Egress: network rule `SERVICES.ONBOARDING_WEB_RULE` → EAI `PEOPLE_360_ONBOARDING_WEB_EAI` → app specification
  `ONBOARDING_WEB_SPEC` (`TYPE = EXTERNAL_ACCESS`; `HOST_PORTS` must equal the rule's `VALUE_LIST`). `version_init`
  attaches the EAI to the service; `callbacks.on_spec_approved_or_declined` (manifest `specification_action`)
  re-attaches and restarts the service on approval.
- Approve as consumer: `SHOW SPECIFICATIONS IN APPLICATION PEOPLE_360_APP;` then
  `ALTER APPLICATION PEOPLE_360_APP APPROVE SPECIFICATION ONBOARDING_WEB_SPEC SEQUENCE_NUMBER = <n>;`
- Adding a host: edit the list in `setup.sql` (both places) — the consumer must re-approve the spec.

## Cortex access
```sql
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO APPLICATION PEOPLE_360_APP;
```

## Teardown
```sql
DROP APPLICATION PEOPLE_360_APP CASCADE;
DROP APPLICATION PACKAGE PEOPLE_360_PKG;
DROP LISTING PEOPLE_360_ORG;
```
