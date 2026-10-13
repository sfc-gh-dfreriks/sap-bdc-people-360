import { Router } from "express";
import { runQuery } from "../services/snowflake.js";
import { searchAlternatives, SearchNotConfiguredError, type Offer } from "../services/websearch.js";

// Onboarding scenario: SuccessFactors-derived new hire -> equipment availability
// -> live alternative sourcing for blocked items -> simulated SF write-back.

const router = Router();
const DT = "APP_DATA.DT_WORKFORCE_360";
const ONB_REF = "APP_DATA";      // bundled onboarding reference data (demo enrichment)
const ONB = "ONBOARDING";        // app-owned, SIMULATED SuccessFactors write-back tables

const REGION: Record<string, { region: string; searchRegion: string }> = {
  "US Operations": { region: "North America", searchRegion: "United States" },
  "EU Operations": { region: "EMEA", searchRegion: "Germany EU" },
  "Japan Operations": { region: "APJ", searchRegion: "Japan" },
};

// Demo FX to normalise web prices into the hiring company's currency (units per 1 USD).
const FX_PER_USD: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 150, AUD: 1.52, CAD: 1.37, CHF: 0.88, SEK: 10.5, NOK: 10.7,
  DKK: 6.9, PLN: 4.0, SGD: 1.34, NZD: 1.66, INR: 83, CNY: 7.2, KRW: 1350, HKD: 7.8,
};
function convert(amount: number, from: string, to: string): number | null {
  const f = FX_PER_USD[from?.toUpperCase()], t = FX_PER_USD[to?.toUpperCase()];
  if (!f || !t) return null;
  return Math.round((amount / f) * t * 100) / 100;
}

const WORKDAYS_PER_YEAR = 260;
const ASSUMED_LEAD_DAYS = 7; // used only when a source gives no ship time; flagged in the response

function roleFamily(title: string): string {
  if (/engineer|principal/i.test(title)) return "ENGINEERING";
  if (/^vp$|director/i.test(title)) return "EXECUTIVE";
  return "STANDARD";
}

function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
/** Working days the hire waits for kit after their start date. */
function workdaysLost(start: Date, ready: Date): number {
  let n = 0;
  for (let d = new Date(start); d < ready; d = addDays(d, 1)) if (d.getDay() % 6 !== 0) n++;
  return n;
}

// --------------------------------------------------------------------------
// GET /api/onboarding/options
// --------------------------------------------------------------------------
router.get("/api/onboarding/options", async (_req, res) => {
  try {
    const [titles, depts, comps] = await Promise.all([
      runQuery(`SELECT DISTINCT JOB_TITLE AS v FROM ${DT} ORDER BY 1`),
      runQuery(`SELECT DISTINCT DEPARTMENT AS v FROM ${DT} ORDER BY 1`),
      runQuery(`SELECT DISTINCT COMPANY AS v FROM ${DT} ORDER BY 1`),
    ]);
    res.json({ titles: titles.map((r) => r.v), departments: depts.map((r) => r.v), companies: comps.map((r) => r.v) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/onboarding/template?title=&company=&department=
// --------------------------------------------------------------------------
router.get("/api/onboarding/template", async (req, res) => {
  try {
    const title = String(req.query.title ?? ""), company = String(req.query.company ?? ""), dept = String(req.query.department ?? "");
    const [job] = await runQuery(
      `SELECT ROUND(AVG(SALARY_MIDPOINT), -2) AS salary, ROUND(AVG(SALARY_MIN), -2) AS salary_min,
              ROUND(AVG(SALARY_MAX), -2) AS salary_max, MODE(PAY_GRADE) AS pay_grade, MODE(CURRENCY) AS currency,
              MODE(FLSA_STATUS) AS flsa_status, MODE(EMPLOYMENT_TYPE) AS employment_type, MODE(LOCATION) AS location,
              COUNT(*) AS peers,
              COUNT_IF(DEPARTMENT = ?) AS dept_peers
       FROM ${DT} WHERE JOB_TITLE = ? AND COMPANY = ? AND EMPLOYMENT_STATUS ILIKE 'Active%'`,
      [dept, title, company]
    );
    if (!job || !job.peers) { res.status(404).json({ error: "No SuccessFactors records for that title/company" }); return; }
    const [benefits] = await runQuery(
      `SELECT * FROM ${ONB_REF}.BENEFITS_PLAN WHERE COMPANY = ? AND ? BETWEEN GRADE_MIN AND GRADE_MAX`,
      [company, job.pay_grade as number]
    );
    const salary = Number(job.salary), load = Number(benefits?.benefits_load_pct ?? 25);
    res.json({
      title, company, department: dept, region: REGION[company]?.region ?? company,
      roleFamily: roleFamily(title), ...job, benefits: benefits ?? null,
      loadedAnnualCost: Math.round(salary * (1 + load / 100)),
      dailyLoadedCost: Math.round((salary * (1 + load / 100)) / WORKDAYS_PER_YEAR),
      source: `${DT} (SuccessFactors EC via SAP BDC, bundled in the Native App) + ${ONB_REF}.BENEFITS_PLAN (demo enrichment)`,
    });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/onboarding/kit?roleFamily=&company=&startDate=
// --------------------------------------------------------------------------
async function loadKit(family: string, company: string, startDate: string): Promise<any[]> {
  const rows = await runQuery(
    `SELECT k.ITEM_CODE, k.ITEM_NAME, k.ITEM_SPEC, k.QUANTITY, k.IS_CRITICAL,
            i.SITE, i.ON_HAND, i.RESERVED, GREATEST(i.ON_HAND - i.RESERVED, 0) AS available,
            p.SUPPLIER_ID, p.SUPPLIER_NAME, p.CHANNEL, p.CONTRACT_ID, p.UNIT_COST, p.CURRENCY,
            p.STD_LEAD_DAYS, p.CURRENT_LEAD_DAYS, p.SUPPLY_STATUS, p.DISRUPTION_NOTE
     FROM ${ONB_REF}.EQUIPMENT_KIT k
     LEFT JOIN ${ONB_REF}.IT_INVENTORY i ON i.ITEM_CODE = k.ITEM_CODE AND i.COMPANY = ?
     LEFT JOIN ${ONB_REF}.PREFERRED_SOURCING p ON p.ITEM_CODE = k.ITEM_CODE AND p.COMPANY = ?
     WHERE k.ROLE_FAMILY = ? ORDER BY k.IS_CRITICAL DESC, k.ITEM_CODE`,
    [company, company, family]
  );
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(`${startDate}T00:00:00`);
  return rows.map((r) => {
    const fromStock = Number(r.available) >= Number(r.quantity);
    const lead = fromStock ? 1 : Number(r.current_lead_days);
    const ready = addDays(today, lead);
    return {
      ...r,
      fulfillment: fromStock ? "STOCK" : "PREFERRED",
      readyDate: iso(ready),
      blocking: ready > start,
      lostWorkdays: ready > start ? workdaysLost(start, ready) : 0,
    };
  });
}

router.get("/api/onboarding/kit", async (req, res) => {
  try {
    const kit = await loadKit(String(req.query.roleFamily), String(req.query.company), String(req.query.startDate));
    res.json({ items: kit, blocked: kit.filter((k) => k.blocking).map((k) => k.item_code) });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// POST /api/onboarding/alternatives  { itemCode, roleFamily, company, startDate, dailyLoadedCost }
// --------------------------------------------------------------------------
router.post("/api/onboarding/alternatives", async (req, res) => {
  try {
    const { itemCode, roleFamily: fam, company, startDate, dailyLoadedCost } = req.body ?? {};
    const kit = await loadKit(fam, company, startDate);
    const item = kit.find((k) => k.item_code === itemCode);
    if (!item) { res.status(404).json({ error: `Item ${itemCode} not in kit` }); return; }

    const currency = String(item.currency);
    const qty = Number(item.quantity);
    const daily = Number(dailyLoadedCost) || 0;
    const prefCost = Number(item.unit_cost) * qty;
    const prefLost = Number(item.lostWorkdays);
    const preferred = {
      vendor: item.supplier_name, model: item.item_spec, channel: `${item.channel} (${item.contract_id})`,
      unitCost: Number(item.unit_cost), totalCost: prefCost, currency, leadDays: Number(item.current_lead_days),
      readyDate: item.readyDate, lostWorkdays: prefLost, productivityCost: prefLost * daily,
      totalImpact: prefCost + prefLost * daily, note: item.disruption_note,
    };

    const region = REGION[company]?.searchRegion ?? company;
    const { offers, sources, queries } = await searchAlternatives(String(item.item_spec), region, currency);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(`${startDate}T00:00:00`);
    const alternatives = offers.map((o: Offer, idx: number) => {
      const unit = convert(o.price, o.currency, currency);
      const leadAssumed = o.leadDays == null;
      const lead = o.leadDays ?? ASSUMED_LEAD_DAYS;
      const ready = addDays(today, lead);
      const lost = ready > start ? workdaysLost(start, ready) : 0;
      const total = unit == null ? null : unit * qty;
      const productivity = lost * daily;
      const impact = total == null ? null : total + productivity;
      return {
        id: `alt-${idx + 1}`, ...o, unitCost: unit, totalCost: total, convertedFrom: o.currency !== currency ? o.currency : null,
        leadDays: lead, leadAssumed, readyDate: iso(ready), lostWorkdays: lost, productivityCost: productivity,
        totalImpact: impact,
        costDelta: total == null ? null : total - prefCost,
        daysSaved: prefLost - lost,
        netBenefit: impact == null ? null : preferred.totalImpact - impact,
      };
    }).sort((a, b) => (b.netBenefit ?? -Infinity) - (a.netBenefit ?? -Infinity));

    const best = alternatives.find((a) => a.netBenefit != null && a.netBenefit > 0 && a.specMatch !== "partial");
    res.json({ item, preferred, alternatives, recommendedId: best?.id ?? null, queries, sources: sources.map(({ title, url }) => ({ title, url })) });
  } catch (err) {
    if (err instanceof SearchNotConfiguredError) { res.status(412).json({ error: err.message, code: "SEARCH_NOT_CONFIGURED" }); return; }
    res.status(500).json({ error: String(err) });
  }
});

// --------------------------------------------------------------------------
// POST /api/onboarding/submit — simulated SuccessFactors write-back
// --------------------------------------------------------------------------
router.post("/api/onboarding/submit", async (req, res) => {
  try {
    const { hire, kit, substitution } = req.body ?? {};
    if (!hire?.candidateName || !hire?.title || !hire?.company || !hire?.startDate) {
      res.status(400).json({ error: "candidateName, title, company and startDate are required" }); return;
    }
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const requestId = `ONB-${stamp}`;
    const personId = `NH${stamp.slice(4)}`;
    const [first, ...rest] = String(hire.candidateName).trim().split(/\s+/);

    // Shape mirrors SuccessFactors EC OData v2 upsert entities.
    const payload = {
      "__metadata": { uri: "/odata/v2/upsert" },
      entities: [
        { "__metadata": { type: "SFOData.PerPerson" }, personIdExternal: personId },
        { "__metadata": { type: "SFOData.PerPersonal" }, personIdExternal: personId, firstName: first, lastName: rest.join(" ") || first, startDate: hire.startDate },
        { "__metadata": { type: "SFOData.EmpEmployment" }, personIdExternal: personId, userId: personId, startDate: hire.startDate },
        { "__metadata": { type: "SFOData.EmpJob" }, userId: personId, startDate: hire.startDate, jobTitle: hire.title,
          department: hire.department, company: hire.company, payGrade: String(hire.payGrade), flsaStatus: hire.flsaStatus,
          eventReason: "HIRNEW", customString1: requestId },
        { "__metadata": { type: "SFOData.EmpCompensation" }, userId: personId, startDate: hire.startDate, eventReason: "HIRNEW" },
        { "__metadata": { type: "SFOData.EmpPayCompRecurring" }, userId: personId, startDate: hire.startDate,
          payComponent: "BASE_SALARY", paycompvalue: hire.salary, currencyCode: hire.currency, frequency: "ANN" },
        { "__metadata": { type: "SFOData.cust_EquipmentRequest" }, externalCode: requestId, cust_userId: personId,
          cust_lines: (kit ?? []).map((k: any) => ({ itemCode: k.itemCode, qty: k.quantity, fulfillment: k.fulfillment,
            supplier: k.supplier, expectedDate: k.expectedDate })),
          cust_status: substitution ? "SUBSTITUTE_SOURCING_REQUESTED" : "SUBMITTED" },
      ],
    };

    const status = substitution ? "PENDING_SOURCING" : "SUBMITTED";
    await runQuery(
      `INSERT INTO ${ONB}.SF_WRITEBACK_EMPHIRE
         (REQUEST_ID, PERSON_ID_EXTERNAL, CANDIDATE_NAME, JOB_TITLE, DEPARTMENT, COMPANY, PAY_GRADE, ANNUAL_SALARY, CURRENCY, START_DATE, ODATA_PAYLOAD, STATUS)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?), ?`,
      [requestId, personId, hire.candidateName, hire.title, hire.department ?? null, hire.company, hire.payGrade ?? null,
       hire.salary ?? null, hire.currency ?? null, hire.startDate, JSON.stringify(payload), status]
    );
    for (const [i, k] of (kit ?? []).entries()) {
      await runQuery(
        `INSERT INTO ${ONB}.SF_WRITEBACK_EQUIPMENT_REQUEST
           (REQUEST_ID, LINE_NO, ITEM_CODE, ITEM_NAME, QUANTITY, FULFILLMENT, SUPPLIER, UNIT_COST, CURRENCY, EXPECTED_DATE, STATUS)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [requestId, (i + 1) * 10, k.itemCode, k.itemName, k.quantity, k.fulfillment, k.supplier ?? null, k.unitCost ?? null,
         k.currency ?? null, k.expectedDate ?? null, k.fulfillment === "SUBSTITUTE" ? "SOURCING_REQUESTED" : "RESERVED"]
      );
    }
    if (substitution) {
      await runQuery(
        `INSERT INTO ${ONB}.SOURCING_DECISION (REQUEST_ID, ITEM_CODE, PREFERRED, ALTERNATIVES, CHOSEN, RATIONALE)
         SELECT ?, ?, PARSE_JSON(?), PARSE_JSON(?), PARSE_JSON(?), ?`,
        [requestId, substitution.itemCode, JSON.stringify(substitution.preferred ?? null),
         JSON.stringify(substitution.alternatives ?? []), JSON.stringify(substitution.chosen ?? null), substitution.rationale ?? null]
      );
    }
    res.json({ requestId, personIdExternal: personId, status, payload });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// --------------------------------------------------------------------------
// GET /api/onboarding/history
// --------------------------------------------------------------------------
router.get("/api/onboarding/history", async (_req, res) => {
  try {
    const rows = await runQuery(
      `SELECT h.REQUEST_ID, h.PERSON_ID_EXTERNAL, h.CANDIDATE_NAME, h.JOB_TITLE, h.COMPANY, h.START_DATE, h.STATUS, h.CREATED_AT,
              d.CHOSEN:vendor::STRING AS substitute_vendor, d.CHOSEN:model::STRING AS substitute_model
       FROM ${ONB}.SF_WRITEBACK_EMPHIRE h LEFT JOIN ${ONB}.SOURCING_DECISION d USING (REQUEST_ID)
       ORDER BY h.CREATED_AT DESC LIMIT 25`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default router;
