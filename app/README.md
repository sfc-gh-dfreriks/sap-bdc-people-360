# SAP People 360

A self-contained Snowflake Native App that runs the **SAP BDC People 360**
workforce dashboard (React + Express) on Snowpark Container Services.

## What's inside

- **Interactive dashboard** — Overview, Headcount, Diversity, Compensation,
  Attrition, Performance, Learning, Recruiting, Org, Employees, and Lineage pages.
- **HR onboarding scenario** — make a hire from SuccessFactors data, find that the
  laptop is backordered, search the web for a priced substitute (Cortex AI_COMPLETE
  reads the result pages), and write the hire and equipment request back. The
  write-back is simulated: payloads are stored in the app's `ONBOARDING` schema.
- **Bundled data** — All workforce data is packaged with the app (no external
  references or shares). It runs immediately after install.
- **Navigation** — Ask Cortex is first in the menu, then the Executive Dashboard,
  which is where the app opens.
- **Ask Cortex** — The first page, plus an "Ask Cortex about <page>" button on
  every data page. Facts are read from the bundled data and summarised by Cortex
  `COMPLETE` (`claude-sonnet-4-5`). Without Cortex access it shows a "not available
  in this installation" message instead of an error.
- **Semantic view** — The bundled **`SAP_PEOPLE_360_ANALYTICS`** semantic view is
  the same model behind the account-level **`SAP_PEOPLE_ANALYST`** Cortex Agent; ask
  that agent free-form questions in Snowflake Intelligence (there is no in-app agent page).

## Data model

Employee-level workforce facts plus performance, learning, and recruiting —
headcount, attrition, diversity, compensation, tenure and org structure.

## Install

1. Grant the requested account privileges (CREATE COMPUTE POOL, BIND SERVICE
   ENDPOINT, CREATE WAREHOUSE, CREATE EXTERNAL ACCESS INTEGRATION).
2. Activate the app — the version initializer creates the compute pool,
   warehouse, and the `PEOPLE_360_SERVICE` container service.
3. Launch the app from the default web endpoint.
4. Optional — to run the onboarding scenario live, approve the app specification
   **Onboarding: web search for equipment alternatives** (app → Security). It allows
   outbound HTTPS to a search endpoint and a fixed list of retailer and OEM sites only;
   no People data is sent. Decline it and every other page works unchanged.

## Cortex access

Grant the app the `SNOWFLAKE.CORTEX_USER` database role so Ask Cortex
can call `COMPLETE`. The model must be
available in your region, or cross-region inference enabled
(`ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION'`).
