# SAP BDC People 360

A reference implementation showing how to turn **SAP Business Data Cloud (BDC)
Standard Data Products** into a live, AI-powered **workforce analytics** app on
Snowflake — using a **medallion architecture**, a governed **semantic view**, a
**Cortex Agent**, and a self-contained **Snowflake Native App** (React + Express
on Snowpark Container Services), deployable across multiple regions.

Zero ETL. Zero copy. Full SAP business context preserved.

## What's in here
```
sap-bdc-people-360/
├── sql/     01_l0_sources.md · 02_l1_curated_views · 03_l2_analytics_dynamic_tables · 04_semantic_view · 05_cortex_agent
├── app/     Native App package (manifest, setup.sql, service_spec, snowflake.yml)
├── service/app/  React (Vite) client + Express server + Dockerfile
├── scripts/ build_and_push · migrate_data · deploy_native_app · create_org_listing
└── docs/    ARCHITECTURE.md · INSTALL.md · DEMO_GUIDE.md · demo deck (.pptx)
```

## Architecture at a glance
`SAP BDC Core Workforce (L0)` → `SAP_BDC_L1.WORKFORCE (L1)` →
`ANALYTICS.* (L2)` → `SAP_PEOPLE_360_ANALYTICS semantic view` →
`SAP_PEOPLE_ANALYST` + Native App "Ask the Agent". Detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start
- **Data platform + agent:** run `sql/02`→`sql/05`, then chat with `SAP_PEOPLE_ANALYST` in Snowflake Intelligence.
- **Native App:** `build_and_push.sh` → `migrate_data.py` → `deploy_native_app.py` → `create_org_listing.py`. Runbook: [`docs/INSTALL.md`](docs/INSTALL.md).

## The app
A React dashboard: **Overview, Headcount, Diversity, Compensation, Attrition,
Performance, Learning, Recruiting, Org, Employees, Lineage**, plus an **Ask the
Agent** page (Cortex Analyst over the bundled `SAP_PEOPLE_360_ANALYTICS` view).

## Live reference deployment
Region-scoped organization listing (`ORGDATACLOUD$INTERNAL$PEOPLE_360_ORG`), 3 regions:

| Region | App URL |
|--------|---------|
| North America | https://irzht4-sfsenorthamerica-dfreriks-aws1-w2.snowflakecomputing.app |
| EMEA | https://ma3ite-sfseeurope-dfreriks-eu-demo.snowflakecomputing.app |
| APAC | https://mahbbd-sfseapac-sap-data-product-demo.snowflakecomputing.app |

> URLs are the internal reference deployment; consumers get their own URL on install.

## Security notes
- No credentials committed. Scripts read key-pair connections from
  `~/.snowflake/connections.toml` by name; `.gitignore` excludes `*.p8`, `.env`, `connections.toml`.
- L0 SAP BDC products are read-only zero-copy shares.

## Sibling projects
`sap-bdc-finance-360` · `sap-bdc-supply-chain-360` · `sap-bdc-sales-360`
