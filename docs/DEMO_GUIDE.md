# Demo Guide — SAP BDC People 360

A ~10-minute flow showing how Snowflake × SAP Business Data Cloud turns SAP HCM /
SuccessFactors workforce data into a live, AI-powered app. Full deck (with
presenter notes): [`SAP_People_360_Demo_Guide.pptx`](SAP_People_360_Demo_Guide.pptx).

## The story in one line
Two platforms, one governed data foundation: SAP BDC shares governed workforce
data into Snowflake with **zero copy**; Snowflake adds AI, apps and global reach —
no pipelines, full SAP context preserved.

## 10-minute flow
1. **Open the app** — no setup; data is already inside (bundled Native App).
   It opens on the **Executive Dashboard** (second in the menu). **Ask Cortex**, first in
   the menu: click *Run workforce briefing* for a Cortex-written summary. Each page below
   also has an **Ask Cortex about <page>** button — use it on Attrition.
2. **Executive Dashboard** — headcount, attrition and diversity KPIs.
3. **Headcount & Org** — by department, division, location; span of control.
4. **Diversity & Compensation** — gender/generation mix, pay equity, top earners.
5. **Attrition** — terminations, reasons, tenure bands.
6. **Performance / Learning / Recruiting** — ratings, high-potentials, hiring funnel.
7. **Snowflake Intelligence** — live questions to `SAP_PEOPLE_ANALYST` (no in-app agent page):
   - "What is headcount by department?"
   - "What is our attrition rate and top termination reasons?"
   - "Show pay equity by gender and pay grade."
8. **Onboarding Scenario** (+3 min, for HR ops / IT / procurement) — the offer is
   derived from 36 peers; the laptop is backordered 42 days (17 idle workdays ≈
   $10,812); search the web, pick an offer on total impact, write back to
   SuccessFactors (simulated).
9. **Recap** — zero-ETL, governed, AI-ready, one-click distribution.

## Key points to land
- Data is **already inside Snowflake** — no ETL, no waiting.
- SAP **business context preserved** (headcount, FTE, tenure, compa-ratio).
- `SAP_PEOPLE_ANALYST` answers live, in plain English, with governed SQL.
- One definition → **three regions** (US, EMEA, APAC), each its own governed install.

## Do / Don't
- **Do** ask the agent a real question live; lead with people outcomes.
- **Don't** pre-load canned answers or dwell on architecture/SQL.
- **Don't** quote a laptop vendor or price from a previous run — the search is live.
- **Do** say the onboarding write-back is simulated and the kit/supplier data is demo enrichment.
- **Don't** promise cross-region magic — each region is its own governed install.
