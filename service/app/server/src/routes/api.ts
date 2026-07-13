import { Router, type Request, type Response } from "express";
import { runQuery } from "../services/snowflake.js";
import { callCortexAnalyst } from "../services/analyst.js";

const router = Router();
const DT = "APP_DATA.DT_WORKFORCE_360";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function parseList(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

/** Build a WHERE clause + binds for department / company filters. */
function filters(req: Request): { where: string; binds: string[] } {
  const depts = parseList(req.query.departments);
  const comps = parseList(req.query.companies);
  const parts: string[] = [];
  const binds: string[] = [];
  if (depts.length) { parts.push(`DEPARTMENT IN (${depts.map(() => "?").join(",")})`); binds.push(...depts); }
  if (comps.length) { parts.push(`COMPANY IN (${comps.map(() => "?").join(",")})`); binds.push(...comps); }
  return { where: parts.length ? `WHERE ${parts.join(" AND ")}` : "", binds };
}

/** Department-only filter (for tables without a COMPANY column). */
function deptFilter(req: Request): { where: string; binds: string[] } {
  const depts = parseList(req.query.departments);
  if (!depts.length) return { where: "", binds: [] };
  return { where: `WHERE DEPARTMENT IN (${depts.map(() => "?").join(",")})`, binds: depts };
}

// --------------------------------------------------------------------------
// GET /api/filters
// --------------------------------------------------------------------------
router.get("/api/filters", async (_req, res) => {
  try {
    const [depts, comps] = await Promise.all([
      runQuery(`SELECT DISTINCT DEPARTMENT AS v FROM ${DT} ORDER BY 1`),
      runQuery(`SELECT DISTINCT COMPANY AS v FROM ${DT} ORDER BY 1`),
    ]);
    res.json({
      departments: depts.map((r) => r.v),
      companies: comps.map((r) => r.v),
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/overview
// --------------------------------------------------------------------------
router.get("/api/overview", async (req, res) => {
  try {
    const { where, binds } = filters(req);
    const [kpis, byDept, gender, generation, trend] = await Promise.all([
      runQuery(
        `SELECT SUM(HEADCOUNT) AS active_headcount,
                SUM(TERMINATIONS) AS terminations,
                SUM(EXTERNAL_HIRES) AS external_hires,
                ROUND(100*SUM(TERMINATIONS)/NULLIF(COUNT(*),0),1) AS attrition_pct,
                ROUND(AVG(CASE WHEN EMPLOYMENT_STATUS='Active' THEN ANNUAL_SALARY END)) AS avg_salary,
                ROUND(100*SUM(CASE WHEN GENDER='Female' AND EMPLOYMENT_STATUS='Active' THEN 1 ELSE 0 END)
                      /NULLIF(SUM(HEADCOUNT),0),1) AS pct_female,
                ROUND(100*SUM(CASE WHEN IS_MANAGER AND EMPLOYMENT_STATUS='Active' THEN 1 ELSE 0 END)
                      /NULLIF(SUM(HEADCOUNT),0),1) AS pct_managers
           FROM ${DT} ${where}`, binds),
      runQuery(`SELECT DEPARTMENT AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT GENDER AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT GENERATION AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(
        `SELECT HIRE_YEAR AS year, SUM(EXTERNAL_HIRES) AS hires,
                SUM(TERMINATIONS) AS terminations
           FROM ${DT} ${where} GROUP BY 1 ORDER BY 1`, binds),
    ]);
    res.json({ kpis: kpis[0] ?? {}, byDept, gender, generation, trend });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/headcount
// --------------------------------------------------------------------------
router.get("/api/headcount", async (req, res) => {
  try {
    const { where, binds } = filters(req);
    const [byDept, byDivision, byLocation, byType, byTenure] = await Promise.all([
      runQuery(`SELECT DEPARTMENT AS name, SUM(HEADCOUNT) AS headcount, ROUND(SUM(FTE),1) AS fte FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT DIVISION AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT LOCATION AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT EMPLOYMENT_TYPE AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT TENURE_BAND AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY DECODE(TENURE_BAND,'<1 yr',1,'1-3 yrs',2,'3-5 yrs',3,'5-10 yrs',4,'10+ yrs',5)`, binds),
    ]);
    res.json({ byDept, byDivision, byLocation, byType, byTenure });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/diversity
// --------------------------------------------------------------------------
router.get("/api/diversity", async (req, res) => {
  try {
    const { where, binds } = filters(req);
    const [genderByDept, generation, ageBand, femaleByGrade] = await Promise.all([
      runQuery(`SELECT DEPARTMENT AS name,
                  SUM(CASE WHEN GENDER='Female' THEN HEADCOUNT ELSE 0 END) AS female,
                  SUM(CASE WHEN GENDER='Male' THEN HEADCOUNT ELSE 0 END) AS male,
                  SUM(CASE WHEN GENDER='Non-binary' THEN HEADCOUNT ELSE 0 END) AS nonbinary
                FROM ${DT} ${where} GROUP BY 1 ORDER BY 1`, binds),
      runQuery(`SELECT GENERATION AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1`, binds),
      runQuery(`SELECT AGE_BAND AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1 ORDER BY 1`, binds),
      runQuery(`SELECT PAY_GRADE AS grade,
                  ROUND(100*SUM(CASE WHEN GENDER='Female' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0),1) AS pct_female
                FROM ${DT} ${where} GROUP BY 1 ORDER BY 1`, binds),
    ]);
    res.json({ genderByDept, generation, ageBand, femaleByGrade });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/compensation
// --------------------------------------------------------------------------
router.get("/api/compensation", async (req, res) => {
  try {
    const { where, binds } = filters(req);
    const w2 = where ? `${where} AND EMPLOYMENT_STATUS='Active'` : `WHERE EMPLOYMENT_STATUS='Active'`;
    const [byDept, byGrade, payEquity, topEarners] = await Promise.all([
      runQuery(`SELECT DEPARTMENT AS name, ROUND(AVG(ANNUAL_SALARY)) AS avg_salary, COUNT(*) AS n FROM ${DT} ${w2} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT PAY_GRADE AS grade, ROUND(AVG(ANNUAL_SALARY)) AS avg_salary, ROUND(AVG(COMPA_RATIO),3) AS avg_compa FROM ${DT} ${w2} GROUP BY 1 ORDER BY 1`, binds),
      runQuery(`SELECT GENDER AS name, ROUND(AVG(ANNUAL_SALARY)) AS avg_salary FROM ${DT} ${w2} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT EMPLOYEE_ID, JOB_TITLE, DEPARTMENT, ANNUAL_SALARY, COMPA_RATIO FROM ${DT} ${w2} ORDER BY ANNUAL_SALARY DESC LIMIT 15`, binds),
    ]);
    res.json({ byDept, byGrade, payEquity, topEarners });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/attrition
// --------------------------------------------------------------------------
router.get("/api/attrition", async (req, res) => {
  try {
    const { where, binds } = filters(req);
    const [byDept, byDivision, reasons, byTenure] = await Promise.all([
      runQuery(`SELECT DEPARTMENT AS name, SUM(TERMINATIONS) AS terminations,
                  ROUND(100*SUM(TERMINATIONS)/NULLIF(COUNT(*),0),1) AS attrition_pct
                FROM ${DT} ${where} GROUP BY 1 ORDER BY 3 DESC`, binds),
      runQuery(`SELECT DIVISION AS name, SUM(TERMINATIONS) AS terminations FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT TERMINATION_REASON AS name, COUNT(*) AS n FROM ${DT} ${where}${where ? " AND" : " WHERE"} TERMINATION_REASON <> '' GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT TENURE_BAND AS name, SUM(TERMINATIONS) AS terminations FROM ${DT} ${where} GROUP BY 1 ORDER BY DECODE(TENURE_BAND,'<1 yr',1,'1-3 yrs',2,'3-5 yrs',3,'5-10 yrs',4,'10+ yrs',5)`, binds),
    ]);
    res.json({ byDept, byDivision, reasons, byTenure });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/org
// --------------------------------------------------------------------------
router.get("/api/org", async (req, res) => {
  try {
    const { where, binds } = filters(req);
    const [byDivision, managers, spanOfControl, critical] = await Promise.all([
      runQuery(`SELECT DIVISION AS name, COMPANY AS company, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1,2 ORDER BY 3 DESC`, binds),
      runQuery(`SELECT CASE WHEN IS_MANAGER THEN 'Managers' ELSE 'Individual Contributors' END AS name, SUM(HEADCOUNT) AS headcount FROM ${DT} ${where} GROUP BY 1`, binds),
      runQuery(`SELECT DEPARTMENT AS name, ROUND(AVG(CASE WHEN IS_MANAGER THEN DIRECT_REPORTS END),1) AS avg_span FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC NULLS LAST`, binds),
      runQuery(`SELECT DEPARTMENT AS name, SUM(IS_CRITICAL_POSITION) AS critical_positions FROM ${DT} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
    ]);
    res.json({ byDivision, managers, spanOfControl, critical });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/employees — detail table
// --------------------------------------------------------------------------
router.get("/api/employees", async (req, res) => {
  try {
    const { where, binds } = filters(req);
    const rows = await runQuery(
      `SELECT EMPLOYEE_ID, JOB_TITLE, DEPARTMENT, DIVISION, LOCATION, GENDER, GENERATION,
              EMPLOYMENT_STATUS, PAY_GRADE, ANNUAL_SALARY, TENURE_YEARS, IS_MANAGER
         FROM ${DT} ${where} ORDER BY ANNUAL_SALARY DESC LIMIT 200`, binds);
    res.json({ rows });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/performance  /api/learning  /api/recruiting
// --------------------------------------------------------------------------
router.get("/api/performance", async (req, res) => {
  try {
    const { where, binds } = deptFilter(req);
    const P = "APP_DATA.DT_PERFORMANCE";
    const w = where ? `${where} AND REVIEW_YEAR=2025` : `WHERE REVIEW_YEAR=2025`;
    const [dist, byDept, potential, hipo] = await Promise.all([
      runQuery(`SELECT RATING_LABEL AS name, COUNT(*) AS n FROM ${P} ${w} GROUP BY 1, RATING ORDER BY RATING`, binds),
      runQuery(`SELECT DEPARTMENT AS name, ROUND(AVG(RATING),2) AS avg_rating FROM ${P} ${w} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT POTENTIAL AS name, COUNT(*) AS n FROM ${P} ${w} GROUP BY 1`, binds),
      runQuery(`SELECT COUNT(*) AS high_potentials FROM ${P} ${w} AND IS_HIGH_POTENTIAL=TRUE`, binds),
    ]);
    res.json({ dist, byDept, potential, hipo: hipo[0] ?? {} });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get("/api/learning", async (req, res) => {
  try {
    const { where, binds } = deptFilter(req);
    const L = "APP_DATA.DT_LEARNING";
    const [byStatus, byCategory, topCourses, hoursByDept] = await Promise.all([
      runQuery(`SELECT STATUS AS name, COUNT(*) AS n FROM ${L} ${where} GROUP BY 1`, binds),
      runQuery(`SELECT CATEGORY AS name, COUNT(*) AS enrollments, SUM(HOURS) AS hours FROM ${L} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
      runQuery(`SELECT COURSE AS name, COUNT(*) AS enrollments, ROUND(100*SUM(IFF(STATUS='Completed',1,0))/NULLIF(COUNT(*),0),1) AS completion_pct FROM ${L} ${where} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`, binds),
      runQuery(`SELECT DEPARTMENT AS name, SUM(HOURS) AS hours FROM ${L} ${where} GROUP BY 1 ORDER BY 2 DESC`, binds),
    ]);
    res.json({ byStatus, byCategory, topCourses, hoursByDept });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

router.get("/api/recruiting", async (req, res) => {
  try {
    const R = "APP_DATA.DT_RECRUITING";
    const [kpis, byStatus, byDept, funnel] = await Promise.all([
      runQuery(`SELECT COUNT(*) AS total_reqs, SUM(IFF(STATUS='Open',1,0)) AS open_reqs,
                  SUM(APPLICATIONS) AS applications, ROUND(AVG(CASE WHEN IS_FILLED THEN DAYS_OPEN END)) AS avg_time_to_fill
                FROM ${R}`),
      runQuery(`SELECT STATUS AS name, COUNT(*) AS n FROM ${R} GROUP BY 1`),
      runQuery(`SELECT DEPARTMENT AS name, SUM(IFF(STATUS='Open',1,0)) AS open_reqs FROM ${R} GROUP BY 1 ORDER BY 2 DESC`),
      runQuery(`SELECT SUM(APPLICATIONS) AS applications, SUM(INTERVIEWS) AS interviews, SUM(OFFERS) AS offers FROM ${R}`),
    ]);
    res.json({ kpis: kpis[0] ?? {}, byStatus, byDept, funnel: funnel[0] ?? {} });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/lineage — SAP BDC sources + medallion lineage into the app
// --------------------------------------------------------------------------
router.get("/api/lineage", async (_req, res) => {
  try {
    const c = (await runQuery(
      `SELECT
         (SELECT COUNT(*) FROM SAP_BDC_DEMO_CORE_WORKFORCE_DATA.BDCCONNECT.COREWORKFORCE_STANDARDFIELDS) AS l0_workforce,
         (SELECT COUNT(*) FROM APP_DATA.DT_WORKFORCE_360) AS dt_workforce,
         (SELECT COUNT(*) FROM APP_DATA.DT_PERFORMANCE) AS dt_performance,
         (SELECT COUNT(*) FROM APP_DATA.DT_LEARNING) AS dt_learning,
         (SELECT COUNT(*) FROM APP_DATA.DT_RECRUITING) AS dt_recruiting`))[0] as any;
    res.json({
      app: "SAP BDC People 360",
      database: "SAP_PEOPLE_360",
      sourceSystems: ["SAP SuccessFactors (Human Experience Management / HXM)"],
      summary:
        "Workforce data flows from SAP SuccessFactors into Snowflake as SAP BDC zero-copy data products (L0), " +
        "is organized into business-area passthrough views (L1), curated into gold dynamic tables and a unified " +
        "semantic view (L2), and served to this app and the SAP People Analyst Cortex Agent — no ETL, no data movement.",
      products: [
        { sapSystem: "SuccessFactors — Employee Central", dataProduct: "Core Workforce Data", l0Object: "SAP_BDC_DEMO_CORE_WORKFORCE_DATA.BDCCONNECT.COREWORKFORCE_STANDARDFIELDS", l1Object: "SAP_BDC_L1.WORKFORCE", rows: c.l0_workforce },
        { sapSystem: "SuccessFactors — Performance & Goals", dataProduct: "Performance Reviews & Ratings", l0Object: "SuccessFactors PMGM data product", l1Object: "ANALYTICS.DT_PERFORMANCE", rows: c.dt_performance },
        { sapSystem: "SuccessFactors — Learning (LMS)", dataProduct: "Learning Enrollment & History", l0Object: "SuccessFactors LMS data product", l1Object: "ANALYTICS.DT_LEARNING", rows: c.dt_learning },
        { sapSystem: "SuccessFactors — Recruiting (RCM)", dataProduct: "Job Requisitions & Applications", l0Object: "SuccessFactors RCM data product", l1Object: "ANALYTICS.DT_RECRUITING", rows: c.dt_recruiting },
      ],
      layers: [
        { name: "SAP Source Systems", tone: "sap", objects: ["SAP SuccessFactors HXM"] },
        { name: "L0 — Bronze (BDC Zero-Copy)", tone: "bronze", objects: ["SAP_BDC_DEMO_CORE_WORKFORCE_DATA", "SuccessFactors PMGM / LMS / RCM products"] },
        { name: "L1 — Silver (Passthrough Views)", tone: "silver", objects: ["SAP_BDC_L1.WORKFORCE"] },
        { name: "L2 — Gold (Dynamic Tables + Semantic View)", tone: "gold", objects: ["ANALYTICS.DT_WORKFORCE_360", "ANALYTICS.DT_PERFORMANCE", "ANALYTICS.DT_LEARNING", "ANALYTICS.DT_RECRUITING", "SEMANTIC.SAP_PEOPLE_360_ANALYTICS"] },
        { name: "AI + Application", tone: "ai", objects: ["AGENTS.SAP_PEOPLE_ANALYST (Cortex Agent)", "SAP BDC People 360 (React)"] },
      ],
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// Cortex Analyst (semantic view) + run-sql
// --------------------------------------------------------------------------
router.post("/api/analyst", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) return res.status(400).json({ error: "messages array is required" });
    res.json(await callCortexAnalyst(messages));
  } catch (err) { console.error("POST /api/analyst error:", err); res.status(500).json({ error: String(err) }); }
});

router.post("/api/analyst/run-sql", async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== "string") return res.status(400).json({ error: "sql string is required" });
    const t = sql.trim().toUpperCase();
    if (!t.startsWith("SELECT") && !t.startsWith("WITH")) return res.status(400).json({ error: "Only SELECT/WITH allowed" });
    const rows = await runQuery(sql);
    res.json({ rows, columns: rows.length > 0 ? Object.keys(rows[0]) : [] });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
