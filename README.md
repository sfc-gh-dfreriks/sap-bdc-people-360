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

## Presales kit

SE-facing deliverables for the SAP Partnership Compass page on Seismic. Same
pattern as the Finance 360 and Sales 360 repos. Seismic has no API, so the
builders write a local folder and the upload is manual.

```bash
python3 tools/people_facts.py                                      # extract figures
python3 ../sap-bdc-finance-360/tools/capture_shots.py --app people # screenshots
python3 tools/build_presales_kit.py                                # 4 SE documents
python3 tools/build_management_summary.py                          # 01
python3 tools/build_demo_scripts.py                                # 02
python3 tools/build_presales_deck.py                               # deck
```

Everything writes to `~/Documents/SAP/People_360_Presales_Kit/`. The screenshot step
needs the app running (`cd ../people_360_react && npm run dev`, client on 5180,
server on 3006) with a `server/.env` pointing at a key-pair connection.

### Nothing is transcribed by hand

`people_facts.py` pulls every figure the documents quote from the live account and
stamps it with the query that produced it, into `/tmp/people_facts.json`. The five
builders read that file, so a document cannot drift from the platform, and
`--print` shows the figure/value/source table for checking.

`docx_kit.py` and `pptx_kit.py` are shims onto the shared implementation owned by
`sap-bdc-finance-360/tools/` — that repo must be checked out alongside this one.
The deck builder runs the shared verifier and should report **0 issues**; it
catches overflow, contrast, accent-colour misuse and over-long subtitles.

### Three things about this domain the documents state explicitly

1. **The agent covers workforce only.** The semantic view carries a single table
   (`WORKFORCE`), so headcount, attrition, compensation, diversity and tenure all
   work while performance, learning and recruiting are dashboard-only. All eight
   built-in questions are workforce questions. Extending the model is the obvious
   next increment.
2. **Only one of the four `ANALYTICS` tables is a dynamic table.** `DT_WORKFORCE_360`
   is; `DT_LEARNING`, `DT_PERFORMANCE` and `DT_RECRUITING` carry the prefix by
   convention and never refresh. A `DT_` prefix is not evidence — the facts module
   uses `SHOW DYNAMIC TABLES`.
3. **There is no single data window.** Hires run to 2026-03 and learning and
   recruiting to 2026-06, but performance reviews stop at review year 2025. The
   documents report the window per table rather than averaging them into one wrong
   sentence.

Because the subject is people, every document raises the synthetic-data question
before a customer can: a `SAP_BDC_DEMO_*` source database, sequential identifiers
rather than SAP personnel numbers, and no employee names anywhere in the analytics
layer. Governance — masking, row access policies, whoever reviews HR data changes —
is treated as part of the demo rather than an afterthought.

### Known gaps

- **No walkthrough video.** Finance 360 and Sales 360 each ship a narrated mp4 built
  from `tools/video/`; People would need a `segments_people.py` and narration.
- **No Word verifier.** `verify_word_assets.py` exists in the Sales repo but is
  hardcoded to that kit's pages and personas — running it here validates Sales
  documents and reports Sales personas, so it is deliberately not vendored.
- The semantic view reports `extension: null`, where the Supply Chain and Ontology
  views carry `CA`/`AI`. Cortex Analyst works because the app passes the view
  explicitly, but verify this before attaching AI products to a data-share listing.
- People 360 publishes the Native App listing only. There is no data-share listing,
  so there is no mount-the-tables route from the Marketplace.

## Security notes
- No credentials committed. Scripts read key-pair connections from
  `~/.snowflake/connections.toml` by name; `.gitignore` excludes `*.p8`, `.env`, `connections.toml`.
- L0 SAP BDC products are read-only zero-copy shares.

## Sibling projects
`sap-bdc-finance-360` · `sap-bdc-supply-chain-360` · `sap-bdc-sales-360`
