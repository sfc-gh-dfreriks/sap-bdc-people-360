# SAP People 360

A self-contained Snowflake Native App that runs the **SAP BDC People 360**
workforce dashboard (React + Express) on Snowpark Container Services.

## What's inside

- **Interactive dashboard** — Overview, Headcount, Diversity, Compensation,
  Attrition, Performance, Learning, Recruiting, Org, Employees, and Lineage pages.
- **Bundled data** — All workforce data is packaged with the app (no external
  references or shares). It runs immediately after install.
- **Ask the Agent** — A natural-language analytics page powered by Cortex
  Analyst over the bundled **`SAP_PEOPLE_360_ANALYTICS`** semantic view — the
  same model behind the account-level **`SAP_PEOPLE_ANALYST`** Cortex Agent.

## Data model

Employee-level workforce facts plus performance, learning, and recruiting —
headcount, attrition, diversity, compensation, tenure and org structure.

## Install

1. Grant the requested account privileges (CREATE COMPUTE POOL, BIND SERVICE
   ENDPOINT, CREATE WAREHOUSE).
2. Activate the app — the version initializer creates the compute pool,
   warehouse, and the `PEOPLE_360_SERVICE` container service.
3. Launch the app from the default web endpoint.

## Cortex access

Grant the app the `SNOWFLAKE.CORTEX_USER` database role so the "Ask the Agent"
page can call Cortex Analyst.
