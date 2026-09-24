#!/usr/bin/env python3
"""Extract every figure the People 360 deliverables quote, with its provenance.

Nothing in the kit, deck or docs is transcribed by hand. Each figure is pulled
live from the account here and stamped with the query that produced it, so a
document cannot drift from what the platform actually contains — and a reader can
re-run the stated source to check any number.

Mirrors tools/finance_facts.py in the sap-bdc-finance-360 repo. Three People 360
specifics that the Finance version does not have to deal with:

  1. Only ONE of the four DT_* objects in ANALYTICS is a dynamic table
     (DT_WORKFORCE_360). DT_LEARNING, DT_PERFORMANCE and DT_RECRUITING are plain
     base tables. The DT_ prefix is not proof of anything, so the prefix is never
     used as evidence — SHOW DYNAMIC TABLES is.
  2. The four tables do not share a date column, and two have none at all in the
     usual sense, so the window is reported per table with the column named.
  3. This is workforce data. Every figure that could look like a real person's
     pay or rating is aggregated here, and the kit says plainly that the dataset
     is synthetic — see the pii block.

Writes /tmp/people_facts.json (the handoff the docx and pptx builders read).

Usage:
    python3 tools/people_facts.py              # extract and write
    python3 tools/people_facts.py --print      # extract and show the table
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sys
import tomllib

import snowflake.connector

CONN = "dfreriksdemo"
DB = "SAP_PEOPLE_360"
OUT = pathlib.Path("/tmp/people_facts.json")
REPO = "https://github.com/sfc-gh-dfreriks/sap-bdc-people-360"
PUBLIC_URL = "https://sfc-gh-dfreriks.github.io/people-360-public/"
APP_LISTING = "ORGDATACLOUD$INTERNAL$PEOPLE_360_ORG"

APP = pathlib.Path.home() / "Documents" / "SAP" / "SAP Skills" / "people_360_react"
SIDEBAR = APP / "client" / "src" / "components" / "Sidebar.tsx"
API_ROUTES = APP / "server" / "src" / "routes" / "api.ts"
ANALYST_SVC = APP / "server" / "src" / "services" / "analyst.ts"
ANALYST_PAGE = APP / "client" / "src" / "pages" / "Analyst.tsx"
APP_DEV_URL = "http://localhost:3006"

# The regions People 360 is published into. Verified with SHOW LISTINGS per region.
REGION_CONNS = ["dfreriksdemo", "dfreriks_eu_demo", "dfreriks_apac_demo"]


def conn_params(name: str) -> dict:
    path = pathlib.Path.home() / ".snowflake" / "connections.toml"
    cfg = tomllib.loads(path.read_text())
    if name not in cfg:
        sys.exit(f"connection {name!r} not in {path}")
    c = dict(cfg[name])
    if "private_key_path" in c:
        c["private_key_file"] = str(pathlib.Path(c.pop("private_key_path")).expanduser())
    c.pop("database", None)
    c.pop("schema", None)
    return c


class Facts:
    """Collects values together with the source that produced each one."""

    def __init__(self, cur):
        self.cur = cur
        self.data: dict = {}
        self.provenance: dict = {}

    def sql_one(self, key: str, sql: str, source: str):
        self.cur.execute(sql)
        row = self.cur.fetchone()
        val = row[0] if row and len(row) == 1 else (list(row) if row else None)
        self.data[key] = self._clean(val)
        self.provenance[key] = source
        return self.data[key]

    def sql_rows(self, key: str, sql: str, source: str):
        self.cur.execute(sql)
        cols = [d[0] for d in self.cur.description]
        self.data[key] = [{c: self._clean(v) for c, v in zip(cols, r)}
                          for r in self.cur.fetchall()]
        self.provenance[key] = source
        return self.data[key]

    def put(self, key, value, source):
        self.data[key] = self._clean(value)
        self.provenance[key] = source
        return value

    @staticmethod
    def _clean(v):
        if isinstance(v, (dt.date, dt.datetime)):
            return v.isoformat()[:10]
        if isinstance(v, list):
            return [Facts._clean(x) for x in v]
        if hasattr(v, "normalize"):  # Decimal
            return float(v)
        return v


def collect(cur) -> Facts:
    f = Facts(cur)
    IS = f"{DB}.INFORMATION_SCHEMA"

    # ---- platform shape -----------------------------------------------------
    f.sql_rows("analytics_objects", f"""
        SELECT TABLE_NAME, TABLE_TYPE, ROW_COUNT FROM {IS}.TABLES
        WHERE TABLE_SCHEMA='ANALYTICS' ORDER BY ROW_COUNT DESC NULLS LAST""",
        "INFORMATION_SCHEMA.TABLES, ANALYTICS")
    f.put("analytics_rows",
          sum(o["ROW_COUNT"] or 0 for o in f.data["analytics_objects"]),
          "sum of ROW_COUNT over ANALYTICS")
    f.sql_rows("l1_objects", f"""
        SELECT TABLE_NAME, TABLE_TYPE FROM {IS}.TABLES
        WHERE TABLE_SCHEMA='SAP_BDC_L1' ORDER BY 1""",
        "INFORMATION_SCHEMA.TABLES, SAP_BDC_L1")

    # A DT_ prefix is not proof of a dynamic table. Here only one of four is.
    cur.execute(f"SHOW DYNAMIC TABLES IN DATABASE {DB}")
    cols = [d[0] for d in cur.description]
    dtrows = [dict(zip(cols, r)) for r in cur.fetchall()]
    f.put("dynamic_tables", sorted(r["name"] for r in dtrows), "SHOW DYNAMIC TABLES")
    f.put("dynamic_table_count", len(dtrows), "SHOW DYNAMIC TABLES")
    f.put("dynamic_table_detail",
          [{"name": r["name"], "target_lag": r["target_lag"],
            "refresh_mode": r["refresh_mode"],
            "data_timestamp": Facts._clean(r.get("data_timestamp"))} for r in dtrows],
          "SHOW DYNAMIC TABLES")
    f.put("dt_prefixed_not_dynamic",
          sorted({o["TABLE_NAME"] for o in f.data["analytics_objects"]
                  if o["TABLE_NAME"].startswith("DT_")}
                 - {r["name"] for r in dtrows}),
          "ANALYTICS DT_* names minus SHOW DYNAMIC TABLES")

    # ---- semantic view ------------------------------------------------------
    svs = []
    cur.execute(f"SHOW SEMANTIC VIEWS IN DATABASE {DB}")
    cols = [d[0] for d in cur.description]
    for r in cur.fetchall():
        d = dict(zip(cols, r))
        svs.append({"fqn": f"{DB}.{d['schema_name']}.{d['name']}",
                    "extension": d.get("extension")})
    f.put("semantic_views", svs, "SHOW SEMANTIC VIEWS")

    detail = {}
    for sv in svs:
        cur.execute(f"DESCRIBE SEMANTIC VIEW {sv['fqn']}")
        c2 = [d[0] for d in cur.description]
        rows = cur.fetchall()
        ki = c2.index("object_kind")
        ni = c2.index("object_name")
        pi = c2.index("parent_entity") if "parent_entity" in c2 else None

        def distinct(kind):
            return {(r[pi] if pi is not None else None, r[ni])
                    for r in rows if r[ki] == kind}

        detail[sv["fqn"]] = {
            "tables": len(distinct("TABLE")),
            "table_names": sorted({r[ni] for r in rows if r[ki] == "TABLE"}),
            "dimensions": len(distinct("DIMENSION")),
            "facts": len(distinct("FACT")),
            "metrics": len(distinct("METRIC")),
            "relationships": len(distinct("RELATIONSHIP")),
            "verified_queries": len({r[ni] for r in rows
                                     if r[ki] and "VERIFIED" in str(r[ki]).upper()}),
        }
    f.put("semantic_view_detail", detail, "DESCRIBE SEMANTIC VIEW")

    # ---- agent --------------------------------------------------------------
    cur.execute(f"SHOW AGENTS IN DATABASE {DB}")
    cols = [d[0] for d in cur.description]
    agents = [dict(zip(cols, r)) for r in cur.fetchall()]
    f.put("agents", [f"{DB}.{a['schema_name']}.{a['name']}" for a in agents],
          "SHOW AGENTS")
    # Note the schema: AGENTS, not ANALYTICS as in Supply Chain 360.
    f.put("agent_schema", sorted({a["schema_name"] for a in agents}), "SHOW AGENTS")

    # ---- data windows, per table -------------------------------------------
    # The four tables do not share a date column. DT_PERFORMANCE has only a
    # REVIEW_YEAR integer, so its window is reported in years, not dates — a
    # single "data window" sentence across all four would be wrong.
    windows = {}
    for tbl, col, kind in (("DT_WORKFORCE_360", "HIRE_DATE", "date"),
                           ("DT_LEARNING", "COMPLETION_DATE", "date"),
                           ("DT_RECRUITING", "OPENED_DATE", "date"),
                           ("DT_PERFORMANCE", "REVIEW_YEAR", "year")):
        cur.execute(f"SELECT MIN({col}), MAX({col}), COUNT({col}), COUNT(*) "
                    f"FROM {DB}.ANALYTICS.{tbl}")
        lo, hi, nonnull, total = cur.fetchone()
        windows[tbl] = {"column": col, "kind": kind,
                        "min": Facts._clean(lo), "max": Facts._clean(hi),
                        "non_null": nonnull, "rows": total}
    cur.execute(f"SELECT MIN(TERMINATION_DATE), MAX(TERMINATION_DATE), "
                f"COUNT(TERMINATION_DATE) FROM {DB}.ANALYTICS.DT_WORKFORCE_360")
    lo, hi, n = cur.fetchone()
    windows["DT_WORKFORCE_360.TERMINATION_DATE"] = {
        "column": "TERMINATION_DATE", "kind": "date",
        "min": Facts._clean(lo), "max": Facts._clean(hi), "non_null": n}
    f.put("data_windows", windows, f"MIN/MAX per column over {DB}.ANALYTICS")

    # ---- workforce figures --------------------------------------------------
    f.sql_one("employees", f"SELECT COUNT(*) FROM {DB}.ANALYTICS.DT_WORKFORCE_360",
              "COUNT(*), DT_WORKFORCE_360")
    f.sql_one("active_employees", f"""
        SELECT COUNT(*) FROM {DB}.ANALYTICS.DT_WORKFORCE_360
        WHERE TERMINATION_DATE IS NULL""",
        "COUNT WHERE TERMINATION_DATE IS NULL, DT_WORKFORCE_360")
    f.sql_one("terminations", f"""
        SELECT COUNT(*) FROM {DB}.ANALYTICS.DT_WORKFORCE_360
        WHERE TERMINATION_DATE IS NOT NULL""",
        "COUNT WHERE TERMINATION_DATE IS NOT NULL, DT_WORKFORCE_360")
    f.sql_one("departments",
              f"SELECT COUNT(DISTINCT DEPARTMENT) FROM {DB}.ANALYTICS.DT_WORKFORCE_360",
              "COUNT DISTINCT DEPARTMENT, DT_WORKFORCE_360")
    f.sql_one("companies",
              f"SELECT COUNT(DISTINCT COMPANY) FROM {DB}.ANALYTICS.DT_WORKFORCE_360",
              "COUNT DISTINCT COMPANY, DT_WORKFORCE_360")
    f.sql_rows("headcount_by_company", f"""
        SELECT COMPANY, COUNT(*) AS EMPLOYEES,
               ROUND(AVG(TENURE_YEARS),1) AS AVG_TENURE
        FROM {DB}.ANALYTICS.DT_WORKFORCE_360 GROUP BY 1 ORDER BY 2 DESC""",
        "GROUP BY COMPANY, DT_WORKFORCE_360")
    f.sql_rows("headcount_by_department", f"""
        SELECT DEPARTMENT, COUNT(*) AS EMPLOYEES
        FROM {DB}.ANALYTICS.DT_WORKFORCE_360 GROUP BY 1 ORDER BY 2 DESC""",
        "GROUP BY DEPARTMENT, DT_WORKFORCE_360")
    # Attrition as a rate needs a denominator; state it as terminations over all
    # records rather than implying an annualised rate the data cannot support.
    f.put("attrition_pct_of_records",
          round(100.0 * f.data["terminations"] / max(f.data["employees"], 1), 1),
          "terminations / total records, DT_WORKFORCE_360 (NOT an annualised rate)")
    f.sql_one("avg_compa_ratio", f"""
        SELECT ROUND(AVG(COMPA_RATIO),3) FROM {DB}.ANALYTICS.DT_WORKFORCE_360
        WHERE COMPA_RATIO IS NOT NULL""",
        "AVG(COMPA_RATIO), DT_WORKFORCE_360")
    f.sql_one("managers", f"""
        SELECT COUNT(*) FROM {DB}.ANALYTICS.DT_WORKFORCE_360
        WHERE IS_MANAGER ILIKE 'Y%' OR IS_MANAGER::VARCHAR IN ('true','TRUE','1')""",
        "COUNT WHERE IS_MANAGER truthy, DT_WORKFORCE_360")
    f.sql_one("critical_positions", f"""
        SELECT COUNT(*) FROM {DB}.ANALYTICS.DT_WORKFORCE_360
        WHERE IS_CRITICAL_POSITION ILIKE 'Y%'
           OR IS_CRITICAL_POSITION::VARCHAR IN ('true','TRUE','1')""",
        "COUNT WHERE IS_CRITICAL_POSITION truthy, DT_WORKFORCE_360")

    # ---- performance / learning / recruiting -------------------------------
    f.sql_rows("performance_distribution", f"""
        SELECT RATING_LABEL, COUNT(*) AS REVIEWS
        FROM {DB}.ANALYTICS.DT_PERFORMANCE GROUP BY 1 ORDER BY 2 DESC""",
        "GROUP BY RATING_LABEL, DT_PERFORMANCE")
    f.sql_one("learning_completions", f"""
        SELECT COUNT(*) FROM {DB}.ANALYTICS.DT_LEARNING
        WHERE STATUS ILIKE 'complet%'""",
        "COUNT WHERE STATUS like complete, DT_LEARNING")
    f.sql_rows("recruiting_by_status", f"""
        SELECT STATUS, COUNT(*) AS REQS
        FROM {DB}.ANALYTICS.DT_RECRUITING GROUP BY 1 ORDER BY 2 DESC""",
        "GROUP BY STATUS, DT_RECRUITING")

    # ---- privacy posture ----------------------------------------------------
    # This is workforce data, so the question "is this real people" will be asked.
    # Record the evidence that it is not: the L0 share is a demo database, and the
    # employee identifiers are synthetic sequential IDs rather than SAP PERNRs.
    f.sql_one("l0_share_db", f"""
        SELECT COUNT(*) FROM SAP_BDC_DEMO_CORE_WORKFORCE_DATA.INFORMATION_SCHEMA.TABLES""",
        "COUNT of tables in SAP_BDC_DEMO_CORE_WORKFORCE_DATA")
    f.sql_rows("sample_employee_ids", f"""
        SELECT EMPLOYEE_ID FROM {DB}.ANALYTICS.DT_WORKFORCE_360
        ORDER BY EMPLOYEE_ID LIMIT 3""",
        "first 3 EMPLOYEE_ID values, DT_WORKFORCE_360")
    f.put("pii_note",
          "Synthetic demo dataset in a SAP_BDC_DEMO_* database. No real employee "
          "records, no names surfaced in the analytics layer.",
          "manual assertion, checked against the L0 database name and ID shape")

    # ---- what the application reads ----------------------------------------
    # Hybrid, like Finance: most pages read the L2 tables, the lineage page reads
    # the raw BDC share directly. It does not read the semantic view.
    sources: dict = {}
    if API_ROUTES.exists():
        for m in re.finditer(r"FROM\s+([A-Z_0-9]+)\.([A-Za-z_0-9]+)\.([A-Za-z_0-9]+)",
                             API_ROUTES.read_text()):
            key = ".".join(m.groups())
            sources[key] = sources.get(key, 0) + 1
    f.put("app_data_sources", dict(sorted(sources.items(), key=lambda kv: -kv[1])),
          f"{API_ROUTES.name} FROM clauses")
    f.put("app_reads_share_directly",
          sorted(k for k in sources if k.startswith("SAP_BDC_DEMO_")),
          f"{API_ROUTES.name} FROM clauses on SAP_BDC_DEMO_*")

    # What Cortex Analyst is pointed at. People 360 uses a semantic VIEW, not a
    # stage model file as Finance 360 does — do not copy the Finance wording.
    analyst_target = None
    if ANALYST_SVC.exists():
        m = re.search(r"semantic_view:\s*[\"']([^\"']+)[\"']", ANALYST_SVC.read_text())
        analyst_target = m.group(1) if m else None
    f.put("analyst_semantic_view", analyst_target,
          f"{ANALYST_SVC.name} semantic_view literal")

    # ---- app surface --------------------------------------------------------
    # NAV_ITEMS entries are single-line with single quotes; match the id/label pair.
    pages = []
    if SIDEBAR.exists():
        pages = [m.group(2) for m in re.finditer(
            r"""id:\s*['"]([\w-]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]""",
            SIDEBAR.read_text())]
    f.put("app_pages", pages, f"{SIDEBAR.name} NAV_ITEMS (id/label pairs)")
    f.put("app_page_count", len(pages), f"{SIDEBAR.name} NAV_ITEMS")

    # ---- the agent's own suggestion chips ----------------------------------
    # Read from source rather than transcribed from a screenshot. Every one of the
    # eight is a workforce question: none touch performance, learning or
    # recruiting, which matches a semantic view carrying only the WORKFORCE table.
    chips = []
    if ANALYST_PAGE.exists():
        m = re.search(r"SUGGESTED_QUESTIONS\s*=\s*\[(.*?)\]", ANALYST_PAGE.read_text(), re.S)
        if m:
            chips = re.findall(r"['\"]([^'\"]{15,})['\"]", m.group(1))
    f.put("agent_questions", chips, f"{ANALYST_PAGE.name} SUGGESTED_QUESTIONS")

    # ---- KPIs exactly as the app displays them ------------------------------
    # Quoting the app's own numbers avoids a kit that disagrees with the screen:
    # e.g. the app's pct_managers uses its own denominator, which is not the same
    # as managers/total records computed here.
    app_kpis = None
    try:
        import urllib.request
        with urllib.request.urlopen(f"{APP_DEV_URL}/api/overview", timeout=8) as r:
            app_kpis = json.loads(r.read()).get("kpis")
    except Exception as e:  # noqa: BLE001
        app_kpis = {"error": f"app not running at {APP_DEV_URL}: {str(e)[:60]}"}
    f.put("app_kpis", app_kpis, f"GET {APP_DEV_URL}/api/overview (kpis block)")

    # SQL equivalents, so the deliverables build whether or not the app is up.
    # These reproduce the app's figures exactly, which also documents its
    # definitions: every rate is over the ACTIVE population, not all records.
    # Verified 2026-09-24 — active 1292, attrition 13.9, salary 116202,
    # female 44.3 (44.2 over all records, which is how the denominator was
    # identified), managers 51.7.
    cur.execute(f"""
        SELECT
          COUNT(CASE WHEN TERMINATION_DATE IS NULL THEN 1 END),
          COUNT(CASE WHEN TERMINATION_DATE IS NOT NULL THEN 1 END),
          ROUND(100.0 * COUNT(CASE WHEN TERMINATION_DATE IS NOT NULL THEN 1 END)
                / COUNT(*), 1),
          ROUND(AVG(CASE WHEN TERMINATION_DATE IS NULL THEN ANNUAL_SALARY END)),
          ROUND(100.0 * COUNT(CASE WHEN TERMINATION_DATE IS NULL AND GENDER ILIKE 'F%'
                                   THEN 1 END)
                / NULLIF(COUNT(CASE WHEN TERMINATION_DATE IS NULL THEN 1 END), 0), 1),
          ROUND(100.0 * COUNT(CASE WHEN TERMINATION_DATE IS NULL
                                    AND IS_MANAGER::VARCHAR ILIKE ANY ('Y%','true','TRUE','1')
                                   THEN 1 END)
                / NULLIF(COUNT(CASE WHEN TERMINATION_DATE IS NULL THEN 1 END), 0), 1)
        FROM {DB}.ANALYTICS.DT_WORKFORCE_360""")
    a, t, att, sal, fem, mgr = cur.fetchone()
    sql_kpis = {"active_headcount": a, "terminations": t, "attrition_pct": float(att),
                "avg_salary": int(sal), "pct_female": float(fem),
                "pct_managers": float(mgr)}
    f.put("sql_kpis", sql_kpis,
          "aggregates over DT_WORKFORCE_360, active population as denominator")

    # What the documents actually quote. Prefer the app so the kit and the screen
    # cannot disagree; fall back to the SQL equivalents when the app is not running.
    usable = isinstance(app_kpis, dict) and "active_headcount" in app_kpis
    f.put("kpis", app_kpis if usable else sql_kpis,
          "app /api/overview" if usable else "SQL fallback (app not running)")
    f.put("kpis_source", "application" if usable else "sql_fallback",
          "which source the documents used")

    f.put("public_url", PUBLIC_URL, "constant")

    f.put("public_url", PUBLIC_URL, "constant")
    f.put("app_listing", APP_LISTING, "constant")
    f.put("repo", REPO, "constant")

    cur.execute("SELECT CURRENT_ACCOUNT(), CURRENT_REGION()")
    acct, region = cur.fetchone()
    f.put("account", acct, "CURRENT_ACCOUNT()")
    f.put("region", region, "CURRENT_REGION()")
    f.put("verified_on", dt.date.today().isoformat(), "extraction date")
    return f


def collect_regions(f: Facts):
    """Which regions actually carry the People 360 listing, checked per account."""
    found = []
    for name in REGION_CONNS:
        try:
            cn = snowflake.connector.connect(**conn_params(name))
            cur = cn.cursor()
            cur.execute("SELECT CURRENT_REGION()")
            region = cur.fetchone()[0]
            cur.execute("SHOW LISTINGS LIKE '%PEOPLE_360%'")
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            found.append({
                "connection": name, "region": region,
                "listings": [{"name": r["name"], "state": r["state"],
                              "is_application": r["is_application"]} for r in rows],
            })
            cn.close()
        except Exception as e:  # noqa: BLE001
            found.append({"connection": name, "error": str(e)[:90]})
    f.put("regions", found, "SHOW LISTINGS LIKE '%PEOPLE_360%' per region")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", action="store_true", dest="show")
    args = ap.parse_args()

    cn = snowflake.connector.connect(**conn_params(CONN))
    try:
        f = collect(cn.cursor())
    finally:
        cn.close()
    collect_regions(f)

    OUT.write_text(json.dumps({"facts": f.data, "provenance": f.provenance}, indent=2))
    print(f"wrote {OUT}  ({len(f.data)} facts)")

    if args.show:
        print(f"\n{'figure':32s} {'value':<46s} source")
        print("-" * 120)
        for k, v in f.data.items():
            s = json.dumps(v) if not isinstance(v, (str, int, float, type(None))) else str(v)
            if len(s) > 44:
                s = s[:41] + "..."
            print(f"{k:32s} {s:<46s} {f.provenance[k][:42]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
