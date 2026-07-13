# L0 — SAP BDC Standard Data Products (raw / bronze)

The **L0 (bronze)** layer is the **SAP Business Data Cloud Core Workforce Standard Data Product**, shared into Snowflake with **zero copy, no ETL**.

| L0 Database | Schema | Object | SAP Meaning |
|---|---|---|---|
| `SAP_BDC_DEMO_CORE_WORKFORCE_DATA` | `BDCCONNECT` | `COREWORKFORCE_STANDARDFIELDS` | SAP core workforce standard fields |

## Provisioning

Mounted from the SAP BDC data-product share. L0 is read-only bronze; all shaping happens in L1 (`SAP_BDC_L1.WORKFORCE`, see `02_l1_curated_views.sql`) and L2 (`ANALYTICS.*`, see `03_l2_analytics_dynamic_tables.sql`).
