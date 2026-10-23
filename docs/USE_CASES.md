# Use Cases — SAP BDC People 360

> Workforce analytics over SAP SuccessFactors / HCM data products: headcount, attrition, pay, performance, learning, recruiting.

- **App:** people_360_react (React, server 3006 / client 5180)
- **Semantic view:** `SAP_PEOPLE_360.SEMANTIC.SAP_PEOPLE_360_ANALYTICS`
- **Analytics tables:** DT_WORKFORCE_360
- **Catalog audited:** 2026-09-28. Each use case maps to an existing app page and to fields in the semantic view or API.

| # | Use case | Persona | App page |
|---|---|---|---|
| 1 | Headcount and FTE planning | CHRO / HR business partner | Headcount; Org |
| 2 | Attrition and retention risk | HR business partner | Attrition |
| 3 | Workforce diversity | DEI lead | Diversity |
| 4 | Pay equity and compensation | Total rewards | Compensation |
| 5 | Critical roles and succession | Talent management | Performance; Employees |
| 6 | Hiring pipeline | Talent acquisition | Recruiting |
| 7 | Learning and performance | L&D / people managers | Learning; Performance |
| 8 | New-hire onboarding and equipment readiness | HR operations / IT asset management | Onboarding Scenario |

Every row can also start from **Ask Cortex** (first page, or the "Ask Cortex about <page>" button), which summarises the page's live facts with Cortex.

## 1. Headcount and FTE planning

- **Persona:** CHRO / HR business partner
- **Business question:** How many people do we have, where, and in what roles?
- **Where in the app:** Headcount; Org
- **Data used:** HEADCOUNT, FTE, DIVISION, DEPARTMENT, LOCATION, EMPLOYMENT_TYPE
- **Ask the agent:**
  - "What is headcount by division and location?"
- **Value:** Grounds workforce plans in current, governed numbers.

## 2. Attrition and retention risk

- **Persona:** HR business partner
- **Business question:** Where are we losing people, and why?
- **Where in the app:** Attrition
- **Data used:** TERMINATIONS, TERMINATION_REASON, TENURE_BAND, DEPARTMENT
- **Ask the agent:**
  - "What is attrition by department and termination reason?"
- **Value:** Targets retention efforts at hot spots.

## 3. Workforce diversity

- **Persona:** DEI lead
- **Business question:** How does representation vary by level and department?
- **Where in the app:** Diversity
- **Data used:** GENDER, GENERATION, AGE_BAND, IS_MANAGER, DEPARTMENT
- **Ask the agent:**
  - "What is the gender mix among managers by division?"
- **Value:** Measures progress with consistent definitions.

## 4. Pay equity and compensation

- **Persona:** Total rewards
- **Business question:** Are people paid fairly for their grade?
- **Where in the app:** Compensation
- **Data used:** ANNUAL_SALARY, COMPA_RATIO, PAY_GRADE, JOB_TITLE, GENDER
- **Ask the agent:**
  - "What is the average compa-ratio by pay grade and gender?"
- **Value:** Surfaces equity gaps before review cycles.

## 5. Critical roles and succession

- **Persona:** Talent management
- **Business question:** Which critical positions carry flight risk?
- **Where in the app:** Performance; Employees
- **Data used:** IS_CRITICAL_POSITION, TENURE_YEARS, DIRECT_REPORTS, JOB_TITLE
- **Ask the agent:**
  - "How many critical positions are held by employees with under two years of tenure?"
- **Value:** Protects continuity in key roles.

## 6. Hiring pipeline

- **Persona:** Talent acquisition
- **Business question:** How much are we hiring externally, and where?
- **Where in the app:** Recruiting
- **Data used:** EXTERNAL_HIRES, HIRE_YEAR, DEPARTMENT, LOCATION
- **Ask the agent:**
  - "How many external hires did we make by department this year?"
- **Value:** Balances build vs. buy talent strategy.

## 7. Learning and performance

- **Persona:** L&D / people managers
- **Business question:** Where do we invest in development, and how does it relate to performance?
- **Where in the app:** Learning; Performance
- **Data used:** Pages as built in the app (data from the People 360 L2 layer)
- **Ask the agent:**
  - "Which departments have the most employees in critical positions?"
- **Value:** Directs development spend to impact.

## 8. New-hire onboarding and equipment readiness

- **Persona:** HR operations / IT asset management / procurement
- **Business question:** Will a new starter be productive on day one, and if equipment is late, what is the cheapest way to fix it once idle time is counted?
- **Where in the app:** Onboarding Scenario
- **Data used:** DT_WORKFORCE_360 (peer pay, grade, company) from the SAP BDC share; ONBOARDING.BENEFITS_PLAN, EQUIPMENT_KIT, IT_INVENTORY, PREFERRED_SOURCING (demo enrichment); live web search + Cortex AI_COMPLETE
- **Example:** Senior Engineer, US Operations — $127,200 from 36 peers; Engineering laptop 16" 42 days out → 17 idle workdays ≈ $10,812
- **Ask the agent:** not covered — the agent's semantic view is workforce-only; the scenario runs on the page.
- **Value:** Turns a backorder from an IT ticket into a costed decision, and closes the loop to SuccessFactors (simulated write-back).

---
Example agent questions are suggested prompts; validate answers in the app before customer demos.
