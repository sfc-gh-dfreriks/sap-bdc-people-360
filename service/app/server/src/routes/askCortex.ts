import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
import { runQuery } from "../services/snowflake.js";

// ================================================================ Ask Cortex
// Each topic is a set of SQL "facts" the model must treat as authoritative.
// Queries mirror the ones each page already runs (routes/api.ts, onboarding.ts).
const router = Router();
const MODEL = process.env.CORTEX_MODEL ?? "claude-sonnet-4-5";
const DT = "APP_DATA.DT_WORKFORCE_360";
const P = "APP_DATA.DT_PERFORMANCE";
const L = "APP_DATA.DT_LEARNING";
const R = "APP_DATA.DT_RECRUITING";
const ONB = "APP_DATA";             // bundled onboarding reference data (demo enrichment)
const ONB_WB = "ONBOARDING";         // app-owned SIMULATED write-back tables

type Facts = (args: Record<string, string>) => Promise<Record<string, unknown>>;
const T = (sql: string, binds: string[] = []) => runQuery(sql, binds);
const ORDER_TENURE = `DECODE(TENURE_BAND,'<1 yr',1,'1-3 yrs',2,'3-5 yrs',3,'5-10 yrs',4,'10+ yrs',5)`;

const kpis = async () => (await T(
  `SELECT SUM(HEADCOUNT) active_headcount, SUM(TERMINATIONS) terminations, SUM(EXTERNAL_HIRES) external_hires,
          ROUND(100*SUM(TERMINATIONS)/NULLIF(COUNT(*),0),1) attrition_pct,
          ROUND(AVG(CASE WHEN EMPLOYMENT_STATUS='Active' THEN ANNUAL_SALARY END)) avg_salary,
          ROUND(100*SUM(CASE WHEN GENDER='Female' AND EMPLOYMENT_STATUS='Active' THEN 1 ELSE 0 END)/NULLIF(SUM(HEADCOUNT),0),1) pct_female,
          ROUND(100*SUM(CASE WHEN IS_MANAGER AND EMPLOYMENT_STATUS='Active' THEN 1 ELSE 0 END)/NULLIF(SUM(HEADCOUNT),0),1) pct_managers
     FROM ${DT}`))[0];
const attritionByDept = () => T(`SELECT DEPARTMENT, SUM(HEADCOUNT) headcount, SUM(TERMINATIONS) terminations,
  ROUND(100*SUM(TERMINATIONS)/NULLIF(COUNT(*),0),1) attrition_pct FROM ${DT} GROUP BY 1 ORDER BY 4 DESC`);

export const TOPICS: Record<string, { title: string; facts: Facts }> = {
  general: { title: "cross-functional people and workforce snapshot", facts: async () => ({
    workforce_kpis: await kpis(),
    by_department: await attritionByDept(),
    by_company: await T(`SELECT COMPANY, SUM(HEADCOUNT) headcount, ROUND(AVG(CASE WHEN EMPLOYMENT_STATUS='Active' THEN ANNUAL_SALARY END)) avg_salary FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    top_termination_reasons: await T(`SELECT TERMINATION_REASON, COUNT(*) n FROM ${DT} WHERE TERMINATION_REASON <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 5`),
    performance_2025: (await T(`SELECT ROUND(AVG(RATING),2) avg_rating, COUNT_IF(IS_HIGH_POTENTIAL) high_potentials, COUNT(*) reviews FROM ${P} WHERE REVIEW_YEAR=2025`))[0],
    learning: (await T(`SELECT COUNT(*) enrollments, SUM(HOURS) hours, ROUND(100*COUNT_IF(STATUS='Completed')/NULLIF(COUNT(*),0),1) completion_pct FROM ${L}`))[0],
    recruiting: (await T(`SELECT COUNT(*) total_reqs, SUM(IFF(STATUS='Open',1,0)) open_reqs, SUM(APPLICATIONS) applications, SUM(OFFERS) offers, ROUND(AVG(CASE WHEN IS_FILLED THEN DAYS_OPEN END)) avg_time_to_fill FROM ${R}`))[0],
    gender_pay: await T(`SELECT GENDER, ROUND(AVG(ANNUAL_SALARY)) avg_salary FROM ${DT} WHERE EMPLOYMENT_STATUS='Active' GROUP BY 1`),
  }) },
  overview: { title: "workforce overview (headcount, hires, terminations, attrition)", facts: async () => ({
    kpis: await kpis(),
    by_department: await T(`SELECT DEPARTMENT, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    gender: await T(`SELECT GENDER, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    generation: await T(`SELECT GENERATION, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    hires_vs_terms_by_hire_year: await T(`SELECT HIRE_YEAR, SUM(EXTERNAL_HIRES) hires, SUM(TERMINATIONS) terminations FROM ${DT} GROUP BY 1 ORDER BY 1`),
  }) },
  headcount: { title: "headcount and FTE distribution", facts: async () => ({
    by_department: await T(`SELECT DEPARTMENT, SUM(HEADCOUNT) headcount, ROUND(SUM(FTE),1) fte FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    by_division: await T(`SELECT DIVISION, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    by_location: await T(`SELECT LOCATION, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
    by_employment_type: await T(`SELECT EMPLOYMENT_TYPE, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    by_tenure: await T(`SELECT TENURE_BAND, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY ${ORDER_TENURE}`),
  }) },
  diversity: { title: "diversity and inclusion (gender, generation, age)", facts: async () => ({
    gender_by_department: await T(`SELECT DEPARTMENT, SUM(CASE WHEN GENDER='Female' THEN HEADCOUNT ELSE 0 END) female,
      SUM(CASE WHEN GENDER='Male' THEN HEADCOUNT ELSE 0 END) male, SUM(CASE WHEN GENDER='Non-binary' THEN HEADCOUNT ELSE 0 END) nonbinary FROM ${DT} GROUP BY 1 ORDER BY 1`),
    generation: await T(`SELECT GENERATION, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1`),
    age_band: await T(`SELECT AGE_BAND, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY 1`),
    pct_female_by_pay_grade: await T(`SELECT PAY_GRADE, ROUND(100*SUM(CASE WHEN GENDER='Female' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) pct_female FROM ${DT} GROUP BY 1 ORDER BY 1`),
  }) },
  compensation: { title: "compensation, pay grades and compa-ratio (active employees)", facts: async () => ({
    by_department: await T(`SELECT DEPARTMENT, ROUND(AVG(ANNUAL_SALARY)) avg_salary, COUNT(*) n FROM ${DT} WHERE EMPLOYMENT_STATUS='Active' GROUP BY 1 ORDER BY 2 DESC`),
    by_pay_grade: await T(`SELECT PAY_GRADE, ROUND(AVG(ANNUAL_SALARY)) avg_salary, ROUND(AVG(COMPA_RATIO),3) avg_compa, COUNT(*) n FROM ${DT} WHERE EMPLOYMENT_STATUS='Active' GROUP BY 1 ORDER BY 1`),
    by_gender: await T(`SELECT GENDER, ROUND(AVG(ANNUAL_SALARY)) avg_salary FROM ${DT} WHERE EMPLOYMENT_STATUS='Active' GROUP BY 1 ORDER BY 2 DESC`),
    gender_by_grade: await T(`SELECT PAY_GRADE, GENDER, ROUND(AVG(ANNUAL_SALARY)) avg_salary, COUNT(*) n FROM ${DT} WHERE EMPLOYMENT_STATUS='Active' GROUP BY 1,2 ORDER BY 1,2`),
    top_earners: await T(`SELECT EMPLOYEE_ID, JOB_TITLE, DEPARTMENT, ANNUAL_SALARY, COMPA_RATIO FROM ${DT} WHERE EMPLOYMENT_STATUS='Active' ORDER BY ANNUAL_SALARY DESC LIMIT 10`),
  }) },
  attrition: { title: "attrition and termination drivers", facts: async () => ({
    by_department: await attritionByDept(),
    by_division: await T(`SELECT DIVISION, SUM(TERMINATIONS) terminations FROM ${DT} GROUP BY 1 ORDER BY 2 DESC`),
    reasons: await T(`SELECT TERMINATION_REASON, COUNT(*) n FROM ${DT} WHERE TERMINATION_REASON <> '' GROUP BY 1 ORDER BY 2 DESC`),
    by_tenure: await T(`SELECT TENURE_BAND, SUM(TERMINATIONS) terminations, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1 ORDER BY ${ORDER_TENURE}`),
  }) },
  performance: { title: "2025 performance ratings and potential", facts: async () => ({
    rating_distribution: await T(`SELECT RATING, RATING_LABEL, COUNT(*) n FROM ${P} WHERE REVIEW_YEAR=2025 GROUP BY 1,2 ORDER BY 1`),
    avg_rating_by_department: await T(`SELECT DEPARTMENT, ROUND(AVG(RATING),2) avg_rating, COUNT_IF(IS_HIGH_POTENTIAL) high_potentials, COUNT(*) reviews FROM ${P} WHERE REVIEW_YEAR=2025 GROUP BY 1 ORDER BY 2 DESC`),
    potential: await T(`SELECT POTENTIAL, COUNT(*) n FROM ${P} WHERE REVIEW_YEAR=2025 GROUP BY 1`),
  }) },
  learning: { title: "learning enrollments, hours and completion", facts: async () => ({
    status: await T(`SELECT STATUS, COUNT(*) n FROM ${L} GROUP BY 1`),
    by_category: await T(`SELECT CATEGORY, COUNT(*) enrollments, SUM(HOURS) hours FROM ${L} GROUP BY 1 ORDER BY 2 DESC`),
    top_courses: await T(`SELECT COURSE, COUNT(*) enrollments, ROUND(100*SUM(IFF(STATUS='Completed',1,0))/NULLIF(COUNT(*),0),1) completion_pct FROM ${L} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`),
    hours_by_department: await T(`SELECT DEPARTMENT, SUM(HOURS) hours, ROUND(100*COUNT_IF(STATUS='Completed')/NULLIF(COUNT(*),0),1) completion_pct FROM ${L} GROUP BY 1 ORDER BY 2 DESC`),
  }) },
  recruiting: { title: "recruiting requisitions, funnel and time-to-fill", facts: async () => ({
    kpis: (await T(`SELECT COUNT(*) total_reqs, SUM(IFF(STATUS='Open',1,0)) open_reqs, SUM(APPLICATIONS) applications, ROUND(AVG(CASE WHEN IS_FILLED THEN DAYS_OPEN END)) avg_time_to_fill FROM ${R}`))[0],
    by_status: await T(`SELECT STATUS, COUNT(*) n FROM ${R} GROUP BY 1`),
    by_department: await T(`SELECT DEPARTMENT, SUM(IFF(STATUS='Open',1,0)) open_reqs, ROUND(AVG(CASE WHEN IS_FILLED THEN DAYS_OPEN END)) avg_time_to_fill, SUM(APPLICATIONS) applications FROM ${R} GROUP BY 1 ORDER BY 2 DESC`),
    funnel: (await T(`SELECT SUM(APPLICATIONS) applications, SUM(INTERVIEWS) interviews, SUM(OFFERS) offers FROM ${R}`))[0],
  }) },
  onboarding: { title: "new-hire onboarding equipment readiness (demo enrichment data)", facts: async () => ({
    note: "ONBOARDING schema tables (equipment kits, IT inventory, preferred sourcing, write-backs) are demo enrichment, and the SuccessFactors write-back is simulated.",
    kit_by_role_family: await T(`SELECT ROLE_FAMILY, COUNT(*) items, COUNT_IF(IS_CRITICAL) critical_items FROM ${ONB}.EQUIPMENT_KIT GROUP BY 1 ORDER BY 1`),
    supply_status: await T(`SELECT COMPANY, SUPPLY_STATUS, COUNT(*) items, ROUND(AVG(STD_LEAD_DAYS),1) std_lead, ROUND(AVG(CURRENT_LEAD_DAYS),1) current_lead FROM ${ONB}.PREFERRED_SOURCING GROUP BY 1,2 ORDER BY 1,2`),
    disrupted_items: await T(`SELECT COMPANY, ITEM_CODE, SUPPLIER_NAME, STD_LEAD_DAYS, CURRENT_LEAD_DAYS, DISRUPTION_NOTE FROM ${ONB}.PREFERRED_SOURCING WHERE CURRENT_LEAD_DAYS > STD_LEAD_DAYS ORDER BY CURRENT_LEAD_DAYS DESC LIMIT 15`),
    stock_shortfalls: await T(`SELECT COMPANY, SITE, ITEM_CODE, ON_HAND, RESERVED FROM ${ONB}.IT_INVENTORY WHERE ON_HAND - RESERVED <= 0 LIMIT 20`),
    recent_writebacks: (await T(`SELECT COUNT(*) n FROM ${ONB_WB}.SF_WRITEBACK_EMPHIRE`))[0],
  }) },
  org: { title: "org structure, spans of control and critical positions", facts: async () => ({
    division_company: await T(`SELECT DIVISION, COMPANY, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1,2 ORDER BY 3 DESC`),
    managers_vs_ics: await T(`SELECT CASE WHEN IS_MANAGER THEN 'Managers' ELSE 'Individual Contributors' END AS role_type, SUM(HEADCOUNT) headcount FROM ${DT} GROUP BY 1`),
    avg_span_by_department: await T(`SELECT DEPARTMENT, ROUND(AVG(CASE WHEN IS_MANAGER THEN DIRECT_REPORTS END),1) avg_span, SUM(IS_CRITICAL_POSITION) critical_positions FROM ${DT} GROUP BY 1 ORDER BY 2 DESC NULLS LAST`),
  }) },
  employees: { title: "employee roster profile", facts: async () => ({
    status_mix: await T(`SELECT EMPLOYMENT_STATUS, COUNT(*) n FROM ${DT} GROUP BY 1`),
    by_job_title: await T(`SELECT JOB_TITLE, COUNT(*) n, ROUND(AVG(ANNUAL_SALARY)) avg_salary, ROUND(AVG(TENURE_YEARS),1) avg_tenure FROM ${DT} WHERE EMPLOYMENT_STATUS='Active' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
    top_paid: await T(`SELECT EMPLOYEE_ID, JOB_TITLE, DEPARTMENT, LOCATION, PAY_GRADE, ANNUAL_SALARY, TENURE_YEARS, IS_MANAGER FROM ${DT} ORDER BY ANNUAL_SALARY DESC LIMIT 15`),
  }) },
};

const SYSTEM = `Before answering, check that every number and characterisation in your summary (profit vs loss, up vs down, ages, counts, totals) matches the facts and any table you include; never state a figure the facts do not support.
You are Snowflake Cortex, an SAP SuccessFactors people-analytics advisor for an HR leadership team.
Workforce, performance, learning and recruiting data come from SAP Business Data Cloud data products
(SuccessFactors Employee Central, Performance, Learning, Recruiting) consumed via zero-copy in Snowflake.
Onboarding equipment/sourcing data is demo enrichment and the SuccessFactors write-back is simulated.

Rules:
- The JSON facts below are authoritative. Cite specific departments, divisions, companies, pay grades,
  counts, percentages and salaries from them. Never invent numbers or individuals.
- Lead with the direct answer in one or two sentences, then evidence (a small markdown table when comparing),
  then 2-4 concrete, people-centred recommended actions.
- If the facts do not contain what is needed to answer, say so plainly rather than guessing.
- When citing onboarding/sourcing data, note that it is demo/simulated.
- Treat individuals respectfully; do not speculate about named or identified employees beyond the facts.
- Keep it under 300 words.`;

// Inside the Native App, COMPLETE needs SNOWFLAKE.CORTEX_USER granted to the application (and the
// model available in the consumer's region). Without it, answer with a clear message instead of an error.
const UNAVAILABLE = "**Ask Cortex is not available in this installation.**\n\nThe app could not call Snowflake Cortex " +
  "(`SNOWFLAKE.CORTEX.COMPLETE`). An account admin can enable it with:\n\n" +
  "```sql\nGRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO APPLICATION PEOPLE_360_APP;\n```\n\n" +
  "The model (`" + MODEL + "`) must also be available in this account's region, or cross-region inference enabled.";
const cortexUnavailable = (err: unknown) =>
  /cortex|unknown model|unknown function complete/i.test(String(err));

interface Job { status: "running" | "done" | "error"; answer?: string; error?: string; started: number }
const jobs = new Map<string, Job>();

async function runAsk(topic: string, args: Record<string, string>, question: string): Promise<string> {
  const t = TOPICS[topic];
  const facts = await t.facts(args);
  const q = question?.trim() || `Analyse this ${t.title}: what stands out, why, and what should we do?`;
  const prompt = `${SYSTEM}\n\nTopic: ${t.title}\nContext: ${JSON.stringify(args)}\n\nFACTS (JSON):\n${JSON.stringify(facts).slice(0, 60000)}\n\nQuestion: ${q}`;
  const rows = await runQuery(`SELECT SNOWFLAKE.CORTEX.COMPLETE(?, ?) AS answer`, [MODEL, prompt]);
  const r = rows[0] ?? {};
  return String(r.answer ?? r.ANSWER ?? "No answer returned.");
}

router.get("/api/ask-cortex/topics", (_req, res) => {
  res.json(Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, v.title])));
});

router.post("/api/ask-cortex", (req: Request, res: Response) => {
  const { topic, args = {}, question = "" } = req.body ?? {};
  if (typeof topic !== "string" || !TOPICS[topic]) return res.status(400).json({ error: "unknown topic" });
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) if (typeof v === "string" && v.length < 80) clean[k] = v;
  const id = crypto.randomUUID();
  jobs.set(id, { status: "running", started: Date.now() });
  runAsk(topic, clean, String(question).slice(0, 1000))
    .then((answer) => jobs.set(id, { status: "done", answer, started: Date.now() }))
    .catch((err) => jobs.set(id, cortexUnavailable(err)
      ? { status: "done", answer: UNAVAILABLE, started: Date.now() }
      : { status: "error", error: String(err), started: Date.now() }));
  // Prune jobs older than an hour.
  for (const [k, j] of jobs) if (Date.now() - j.started > 3_600_000) jobs.delete(k);
  res.json({ id });
});

router.get("/api/ask-cortex/:id", (req: Request, res: Response) => {
  const j = jobs.get(String(req.params.id));
  if (!j) return res.status(404).json({ error: "job not found" });
  res.json(j);
});

export default router;
