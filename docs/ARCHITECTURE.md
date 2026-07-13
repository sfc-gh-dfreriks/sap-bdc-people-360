# Architecture — SAP BDC People 360

People 360 is built on a **medallion architecture** inside Snowflake, reading SAP
data via **SAP Business Data Cloud (BDC) zero-copy shares**. No ETL, no copy,
full SAP business context preserved.

```
 SAP SuccessFactors / HCM        SAP Business Data Cloud
 (source of record)   ─────  Core Workforce Data Product  ─────►  Snowflake
                                    (governed, zero-copy)
                                                                │
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  L0  BRONZE  — SAP BDC Standard Data Product                               │
 │      SAP_BDC_DEMO_CORE_WORKFORCE_DATA.BDCCONNECT.COREWORKFORCE_STANDARDFIELDS│
 └──────────────────────────────────────────────────────────────────────────┘
                                                                │  (view)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  L1  SILVER  — SAP_PEOPLE_360.SAP_BDC_L1.WORKFORCE (curated view)          │
 └──────────────────────────────────────────────────────────────────────────┘
                                                                │  (dynamic table + analytics)
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  L2  GOLD  — SAP_PEOPLE_360.ANALYTICS                                      │
 │      DT_WORKFORCE_360 (employee-level fact, dynamic table)                 │
 │      DT_PERFORMANCE · DT_LEARNING · DT_RECRUITING                          │
 └──────────────────────────────────────────────────────────────────────────┘
                                                                │
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  SEMANTIC — SAP_PEOPLE_360_ANALYTICS semantic view                        │
 └──────────────────────────────────────────────────────────────────────────┘
              │                                        │
              ▼                                        ▼
   SAP_PEOPLE_ANALYST agent                 Native App "Ask the Agent"
   (Snowflake Intelligence)                 (Cortex Analyst in-app)
                                                        │
                                            React + Express on SPCS
```

## Layer detail

- **L0 (bronze)** — the SAP BDC Core Workforce standard data product, zero-copy
  shared. Read-only. See [`sql/01_l0_sources.md`](../sql/01_l0_sources.md).
- **L1 (silver)** — `SAP_BDC_L1.WORKFORCE`, a curated governed view over L0.
  DDL: [`sql/02_l1_curated_views.sql`](../sql/02_l1_curated_views.sql).
- **L2 (gold)** — `ANALYTICS`: `DT_WORKFORCE_360` (employee-level dynamic table
  with org, demographics, compensation, tenure, movement) plus `DT_PERFORMANCE`,
  `DT_LEARNING`, `DT_RECRUITING`.
  DDL: [`sql/03_l2_analytics_dynamic_tables.sql`](../sql/03_l2_analytics_dynamic_tables.sql).
- **Semantic** — `SAP_PEOPLE_360_ANALYTICS` semantic view over `DT_WORKFORCE_360`.
  DDL: [`sql/04_semantic_view.sql`](../sql/04_semantic_view.sql).
- **Agent** — `SAP_PEOPLE_ANALYST` Cortex Agent.
  DDL: [`sql/05_cortex_agent.sql`](../sql/05_cortex_agent.sql).

## Native App packaging

For distribution the app is packaged as a **self-contained Snowflake Native
App**: the 4 tables the UI needs are **bundled** into the package's `SHARED_DATA`
schema (no consumer references), and an in-app copy of the
`SAP_PEOPLE_360_ANALYTICS` semantic view powers the Cortex Analyst page. The
React client + Express server run on **Snowpark Container Services**. See
[`app/`](../app) and [`INSTALL.md`](INSTALL.md).
