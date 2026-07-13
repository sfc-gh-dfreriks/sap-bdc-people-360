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
2. **Overview** — headcount, attrition and diversity KPIs.
3. **Headcount & Org** — by department, division, location; span of control.
4. **Diversity & Compensation** — gender/generation mix, pay equity, top earners.
5. **Attrition** — terminations, reasons, tenure bands.
6. **Performance / Learning / Recruiting** — ratings, high-potentials, hiring funnel.
7. **Ask the Agent** — live questions to `SAP_PEOPLE_ANALYST`:
   - "What is headcount by department?"
   - "What is our attrition rate and top termination reasons?"
   - "Show pay equity by gender and pay grade."
8. **Recap** — zero-ETL, governed, AI-ready, one-click distribution.

## Key points to land
- Data is **already inside Snowflake** — no ETL, no waiting.
- SAP **business context preserved** (headcount, FTE, tenure, compa-ratio).
- `SAP_PEOPLE_ANALYST` answers live, in plain English, with governed SQL.
- One definition → **three regions** (US, EMEA, APAC), each its own governed install.

## Do / Don't
- **Do** ask the agent a real question live; lead with people outcomes.
- **Don't** pre-load canned answers or dwell on architecture/SQL.
- **Don't** promise cross-region magic — each region is its own governed install.
