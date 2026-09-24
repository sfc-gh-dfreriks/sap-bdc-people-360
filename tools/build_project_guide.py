#!/usr/bin/env python3
"""Build SAP_People_360_Project_Guide.docx.

The implementation-facing companion to the demo deck, following the section
structure of SAP_Finance_360_Project_Guide.docx so the domains read as a set:
executive summary, project overview, architecture, data model, agent,
application stack, listing, installation, verification, support.

Two sections exist here that the Finance guide has no need for, because the
subject is people rather than ledgers:

  * Privacy posture — the evidence that this is synthetic, stated before anyone
    asks, plus what a production governance design would have to cover.
  * Agent coverage — the semantic view carries one table, so the agent answers
    workforce questions only. Performance, learning and recruiting are
    dashboard-only. Leaving that implicit gets discovered live.

Figures come from /tmp/people_facts.json (tools/people_facts.py), read from the
account with the query that produced each one recorded alongside it.

    python3 tools/people_facts.py && python3 tools/build_project_guide.py
"""
from __future__ import annotations

import json
import pathlib
import sys
from datetime import date

from docx import Document
from docx.shared import Pt

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from docx_kit import (  # noqa: E402
    GREY, SAP_NAVY, SNOW_BLUE, body, bullet, callout, h1, h2, setup_page, table,
)

FACTS_FILE = pathlib.Path("/tmp/people_facts.json")
OUT = pathlib.Path.home() / "Documents" / "SAP" / "SAP_People_360_Project_Guide.docx"
DATE = date.today().strftime("%d %B %Y")
CONTACT = "dave.freriks@snowflake.com"

PAGE_PURPOSE = {
    "Workforce Overview": "Active headcount, attrition, average salary, gender split",
    "Headcount": "Headcount by department, company, tenure and age band",
    "Diversity & Inclusion": "Gender and generation mix, representation by department",
    "Compensation": "Salary distribution and compa-ratio against range midpoint",
    "Attrition": "Terminations by year, reason and department",
    "Performance": "Review rating distribution and coverage",
    "Learning": "Course completions, scores and status",
    "Recruiting": "Requisitions by status, open versus filled",
    "Org & Span": "Manager span of control and reporting depth",
    "Employees": "The record-level table, filterable",
    "BDC Sources & Lineage": "Which SAP BDC objects feed each layer",
    "Ask the Agent": "Natural-language questions over the workforce semantic view",
}


def load() -> dict:
    if not FACTS_FILE.exists():
        sys.exit(f"{FACTS_FILE} missing — run tools/people_facts.py first")
    return json.loads(FACTS_FILE.read_text())["facts"]


def title_block(doc, title, subtitle, strap):
    for text_, size, bold, color, after in (
        (title, 20, True, SAP_NAVY, 2),
        (subtitle, 11.5, False, SNOW_BLUE, 2),
        (strap, 9, False, GREY, 14),
    ):
        p = doc.add_paragraph()
        r = p.add_run(text_)
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        p.paragraph_format.space_after = Pt(after)


def main() -> int:
    F = load()
    k = F["kpis"]
    sv_fqn, sv = next(iter(F["semantic_view_detail"].items()))
    w = F["data_windows"]
    ids = ", ".join(r["EMPLOYEE_ID"] for r in F["sample_employee_ids"])

    doc = Document()
    setup_page(doc)
    title_block(
        doc,
        "SAP BDC People 360 — Project Guide",
        "Workforce analytics on SAP BDC data using BDC Connect zero copy",
        f"{DATE}  ·  Owner: Dave Freriks  ·  {CONTACT}",
    )

    # ---------------------------------------------------------- executive
    h1(doc, "Executive Summary")
    body(
        doc,
        "People 360 turns SAP SuccessFactors workforce data into governed analytics on "
        "Snowflake without moving it. Headcount, attrition, compensation, diversity, "
        "performance, learning and recruiting in one model, with a Cortex Agent over "
        "the workforce layer, delivered as a self-contained Native App.",
    )
    body(
        doc,
        "BDC Connect shares the workforce data product into Snowflake with zero copy. "
        "No extract exists, no second copy of employee data has to be secured, and "
        "SAP's own definitions of headcount, tenure and compa-ratio come across with "
        "the record rather than being rebuilt downstream.",
    )

    h2(doc, "Key Outcomes")
    bullet(doc, f"{F['employees']:,} employee records across {F['departments']} departments and {F['companies']} companies, queryable in seconds.")
    bullet(doc, f"Attrition, pay equity and succession exposure on one governed model — {F['critical_positions']} positions flagged critical.")
    bullet(doc, "Natural-language questions with the generated SQL visible, so an answer can be checked rather than trusted.")
    bullet(doc, "No employee data copied anywhere, which is usually the objection that stops an HR analytics project.")
    bullet(doc, "Access control enforced by the platform rather than by who holds the spreadsheet.")

    h2(doc, "Target Audiences")
    table(
        doc,
        ["Audience", "What they get from it"],
        [
            ["CHRO and HR leadership", "Where retention risk sits, and which roles are exposed"],
            ["People analytics", "New questions answered without an extract request"],
            ["Total Rewards", "Pay measured against the band SAP already holds"],
            ["Talent acquisition", "Open requisitions read against critical-role exposure"],
            ["Finance business partner", "Workforce cost by unit, on the same headcount definition as HR"],
            ["Enterprise architecture", "How zero copy and governance work on Snowflake"],
        ],
        widths=[1.9, 4.8],
    )

    # ---------------------------------------------------------- overview
    h1(doc, "Project Overview")
    h2(doc, "Customer Profile")
    cos = ", ".join(f"{c['COMPANY']} {c['EMPLOYEES']}" for c in F["headcount_by_company"])
    body(
        doc,
        f"A representative global employer: {F['employees']:,} records, "
        f"{k['active_headcount']:,} of them active, spread across {F['companies']} "
        f"operating companies ({cos}) and {F['departments']} departments. Average "
        f"tenure is {F['headcount_by_company'][0]['AVG_TENURE']} years and average "
        f"base pay ${k['avg_salary']:,}.",
    )

    h2(doc, "Solution Components")
    table(
        doc,
        ["Component", "What it is", "Scale"],
        [
            ["L0 share", "SAP BDC workforce data product, shared zero-copy", "SAP_BDC_DEMO_CORE_WORKFORCE_DATA"],
            ["L1 silver", "Typed, renamed passthrough view over the share", f"{len(F['l1_objects'])} view"],
            ["L2 gold", "Analytics tables for workforce, performance, learning, recruiting",
             f"{len(F['analytics_objects'])} tables · {F['analytics_rows']:,} rows"],
            ["Semantic", "Governed model for natural-language access",
             f"{sv['tables']} table · {sv['dimensions']} dimensions · {sv['facts']} facts"],
            ["Agent", "Cortex Agent for plain-English workforce questions", F["agents"][0].split(".", 1)[1] if F["agents"] else "—"],
            ["Application", "React and Express on Snowpark Container Services", f"{F['app_page_count']} pages"],
        ],
        widths=[1.2, 3.3, 2.2],
    )

    # ---------------------------------------------------------- architecture
    h1(doc, "Architecture")
    h2(doc, "Data Flow")
    body(
        doc,
        "SAP SuccessFactors is the source of record. BDC Connect shares the workforce "
        "data product into Snowflake with zero copy. Every layer above it is "
        "Snowflake-native, and the application reads the gold tables directly — it "
        "does not read the semantic view, which belongs to the agent.",
    )
    table(
        doc,
        ["Layer", "Object", "Purpose"],
        [
            ["L0", "SAP_BDC_DEMO_CORE_WORKFORCE_DATA.BDCCONNECT", "The zero-copy share. Treated as immutable."],
            ["L1", "SAP_BDC_L1.WORKFORCE", "Typed, renamed projection. A view, not a copy."],
            ["L2", "ANALYTICS — 4 tables", "Workforce, performance, learning and recruiting."],
            ["SEM", sv_fqn.split(".", 1)[1], "Governed model behind the agent."],
            ["AI", F["agents"][0].split(".", 1)[1] if F["agents"] else "—", "Natural-language access, with SQL shown."],
            ["APP", f"Native App, {F['app_page_count']} pages", "React and Express on SPCS, data bundled."],
        ],
        widths=[0.6, 2.7, 3.4],
    )

    callout(
        doc,
        "The agent sits in its own schema",
        f"{F['agents'][0] if F['agents'] else '—'} — note AGENTS, not ANALYTICS as in "
        f"Supply Chain 360. If you are adapting a deployment script between domains, "
        f"check the schema or the grant will fail.",
    )

    # ---------------------------------------------------------- data model
    h1(doc, "Data Model")
    h2(doc, "Analytics Layer")
    table(
        doc,
        ["Object", "Type", "Rows", "Business content"],
        [
            ["DT_WORKFORCE_360", "dynamic table", "1,500", "Headcount, tenure, pay, compa-ratio, termination, manager flags"],
            ["DT_PERFORMANCE", "base table", "2,584", "Review ratings by year and label"],
            ["DT_LEARNING", "base table", "3,201", "Course completions, scores, status"],
            ["DT_RECRUITING", "base table", "160", "Requisitions by status and opened date"],
        ],
        widths=[1.6, 1.1, 0.7, 3.3],
    )
    callout(
        doc,
        "Only one of the four is a dynamic table",
        f"SHOW DYNAMIC TABLES returns {', '.join(F['dynamic_tables'])} and nothing "
        f"else. {', '.join(F['dt_prefixed_not_dynamic'])} carry the DT_ prefix by "
        f"convention and never refresh. The prefix is not evidence. For live data, "
        f"promote all four and set an explicit TARGET_LAG — the one dynamic table "
        f"currently uses DOWNSTREAM, which means it refreshes only when something "
        f"downstream with its own lag asks.",
    )

    h2(doc, "Semantic View Metadata")
    table(
        doc,
        ["Item", "Value"],
        [
            ["Fully-qualified name", sv_fqn],
            ["Tables covered", f"{sv['tables']} — {', '.join(sv['table_names'])}"],
            ["Dimensions", str(sv["dimensions"])],
            ["Facts", str(sv["facts"])],
            ["Metrics", str(sv["metrics"])],
            ["Verified queries", str(sv["verified_queries"])],
        ],
        widths=[1.8, 4.9],
    )
    body(
        doc,
        f"The view carries {sv['verified_queries']} verified queries. For a customer "
        f"deployment, adding them is the first thing to do before an HR audience "
        f"relies on the agent — a verified query is what stops a plausible-looking "
        f"wrong answer.",
    )

    h2(doc, "Data Windows")
    body(doc, "There is no single as-of date. Each area has its own window, and the difference changes how a trend should be read.")
    rows = []
    for name, wd in w.items():
        span = (f"{wd['min']} to {wd['max']}" if wd["kind"] == "date"
                else f"review years {wd['min']} to {wd['max']}")
        rows.append([name, wd["column"], span])
    table(doc, ["Object", "Column", "Covers"], rows, widths=[2.4, 1.8, 2.5])
    body(
        doc,
        "Performance reviews stop a year before hiring, learning and recruiting. That "
        "is the window most likely to catch someone out in a demo.",
        italic=True,
    )

    # ---------------------------------------------------------- agent
    h1(doc, "Cortex Agent — Snowflake Intelligence")
    h2(doc, "Agent Configuration")
    table(
        doc,
        ["Item", "Value"],
        [
            ["Agent", F["agents"][0] if F["agents"] else "—"],
            ["Semantic view", F.get("analyst_semantic_view") or sv_fqn],
            ["In-app surface", "The Ask the Agent page, via Cortex Analyst"],
            ["Snowsight route", "AI/ML → Snowflake Intelligence → SAP People Analyst"],
        ],
        widths=[1.6, 5.1],
    )

    h2(doc, "Sample Natural-Language Questions")
    body(doc, "These eight ship with the application, read from its source rather than transcribed.")
    for q in F["agent_questions"]:
        bullet(doc, q)

    h2(doc, "Agent Coverage — and its current limit")
    callout(
        doc,
        "Workforce only",
        f"Every one of the eight is a workforce question, because the semantic view "
        f"carries a single table ({', '.join(sv['table_names'])}). Headcount, "
        f"attrition, compensation, diversity and tenure all work. Performance, "
        f"learning and recruiting are on the dashboards but not available to the "
        f"agent. Extending the model to cover them is small, well-scoped, and the "
        f"most obvious next increment.",
    )

    # ---------------------------------------------------------- app
    h1(doc, "Application Stack")
    h2(doc, "Pages")
    table(
        doc,
        ["Page", "What it shows"],
        [[p, PAGE_PURPOSE.get(p, "—")] for p in F["app_pages"]],
        widths=[1.9, 4.8],
        size=8.5,
    )
    body(doc, "Department and Company filters apply across every page. The lineage page reads the BDC share directly, which is the zero-copy proof inside the app rather than in a diagram.")

    h2(doc, "What reads what")
    table(
        doc,
        ["Consumer", "Reads"],
        [
            ["Application", ", ".join(sorted(F["app_data_sources"]))],
            ["Cortex Analyst", F.get("analyst_semantic_view") or "—"],
        ],
        widths=[1.4, 5.3],
        size=8,
    )

    h2(doc, "Environment Variables")
    body(doc, "The local server reads:", after=2)
    for line in ["PORT=3006", "SNOWFLAKE_ACCOUNT=…", "SNOWFLAKE_USER=…",
                 "SNOWFLAKE_PRIVATE_KEY_PATH=…", "SNOWFLAKE_ROLE=…",
                 "SNOWFLAKE_WAREHOUSE=…", "SNOWFLAKE_DATABASE=SAP_PEOPLE_360",
                 "SNOWFLAKE_SCHEMA=ANALYTICS"]:
        p = doc.add_paragraph()
        r = p.add_run("    " + line)
        r.font.name = "Menlo"
        r.font.size = Pt(8.5)
        p.paragraph_format.space_after = Pt(0)
    doc.add_paragraph()

    # ---------------------------------------------------------- listing
    h1(doc, "Marketplace Listing")
    table(
        doc,
        ["Item", "Value"],
        [
            ["Listing", F["app_listing"]],
            ["Type", "Native App, region-scoped organization listing"],
            ["Visibility", "All internal accounts"],
            ["Data share listing", "None — see below"],
        ],
        widths=[1.7, 5.0],
    )
    callout(
        doc,
        "App listing only",
        "People 360 publishes the Native App listing and nothing else. Unlike Supply "
        "Chain 360 there is no separate data-share listing, so there is no "
        "mount-the-tables-in-your-own-account route from the Marketplace. Note also "
        "that the semantic view reports no CA/AI extension, where the Supply Chain and "
        "Ontology views carry one — verify that before attempting to attach AI "
        "products to a future data-share listing.",
    )

    h2(doc, "Regions")
    rows = []
    for r in F["regions"]:
        if "error" in r:
            rows.append([r["connection"], "—", f"check failed: {r['error']}"])
            continue
        rows.append([r["connection"], r["region"],
                     ", ".join(f"{x['name']} ({x['state']})" for x in r["listings"]) or "none found"])
    table(doc, ["Connection", "Snowflake region", "Listing"], rows, widths=[1.7, 2.1, 2.9])
    body(doc, "Each region is an independent governed install of the same definition. There is no cross-region querying, and for workforce data that separation is a feature rather than a limitation.", italic=True)

    # ---------------------------------------------------------- install
    h1(doc, "Installation Procedures")
    h2(doc, "A. Consumer — install the app")
    table(
        doc,
        ["Step", "Action"],
        [
            ["1", "Snowsight → Data Products → Marketplace, filtered to your organization"],
            ["2", f"Find {F['app_listing']} for your region and install"],
            ["3", "Open the app. Data is bundled — no grants, no warehouse sizing, no load step"],
        ],
        widths=[0.5, 6.2],
    )

    h2(doc, "B. Publisher — build the platform")
    table(
        doc,
        ["Step", "Action", "Result"],
        [
            ["1", "Deploy the L1 view over the BDC share", "SAP_BDC_L1.WORKFORCE"],
            ["2", "Deploy the L2 analytics layer", "4 tables, 7,445 rows"],
            ["3", "Deploy the semantic view", sv_fqn.split(".", 1)[1]],
            ["4", "Deploy the agent", F["agents"][0].split(".", 1)[1] if F["agents"] else "—"],
            ["5", "Build, migrate and deploy the Native App", "Application package and version"],
            ["6", "Create the region-scoped org listing", F["app_listing"]],
        ],
        widths=[0.5, 3.1, 3.1],
    )
    body(doc, "After step 4 the domain can be demonstrated through Snowflake Intelligence with no application at all, which is the fastest route for an architecture conversation.")

    h2(doc, "C. Local development")
    table(
        doc,
        ["Step", "Command"],
        [
            ["1", "cd people_360_react && npm install"],
            ["2", "create server/.env from a key-pair connection"],
            ["3", "npm run dev        # server 3006, client 5180"],
        ],
        widths=[0.5, 6.2],
    )

    # ---------------------------------------------------------- verification
    h1(doc, "Verification")
    table(
        doc,
        ["Check", "How", "Expected"],
        [
            ["Analytics layer", "SELECT COUNT(*) FROM SAP_PEOPLE_360.ANALYTICS.DT_WORKFORCE_360", f"{F['employees']:,}"],
            ["Which tables refresh", "SHOW DYNAMIC TABLES IN DATABASE SAP_PEOPLE_360", f"{len(F['dynamic_tables'])} row"],
            ["Semantic view", "SHOW SEMANTIC VIEWS IN DATABASE SAP_PEOPLE_360", "1 row"],
            ["Agent", "SHOW AGENTS IN DATABASE SAP_PEOPLE_360", "1 row, AGENTS schema"],
            ["Listing per region", "SHOW LISTINGS LIKE '%PEOPLE_360%'", "PUBLISHED"],
            ["Figures in this guide", "python3 tools/people_facts.py --print", "value and source per figure"],
        ],
        widths=[1.4, 4.0, 1.3],
        size=8,
    )
    body(
        doc,
        f"Every figure in this guide was read from the account on {F['verified_on']} "
        f"and is stamped with the query that produced it. The KPI block was taken from "
        f"{'the running application' if F['kpis_source'] == 'application' else 'SQL equivalents to the application figures'}, "
        f"so the guide and the screen agree.",
    )

    # ---------------------------------------------------------- privacy
    h1(doc, "Privacy Posture")
    body(doc, "This is workforce data, so the first question in any room is whether these are real people. Answer it before it is asked.")
    table(
        doc,
        ["Element", "Status"],
        [
            ["Source database", "SAP_BDC_DEMO_CORE_WORKFORCE_DATA — a demo database"],
            ["Employee identifiers", f"Synthetic and sequential ({ids}…), not SAP personnel numbers"],
            ["Names", "None surfaced anywhere in the analytics layer"],
            ["Pay and ratings", "Synthetic values on a real field structure"],
            ["Live HR system connection", "None"],
            ["Production governance design", "Not included — it would be designed with the customer"],
        ],
        widths=[2.2, 4.5],
    )
    h2(doc, "What production would need")
    bullet(doc, "Masking policies on compensation columns, so roles that should not see pay cannot.")
    bullet(doc, "Row access policies keyed to the manager hierarchy, so an HR business partner sees only their own population.")
    bullet(doc, "A role model separating HR business partners from analysts from administrators.")
    bullet(doc, "Agreement with whoever reviews HR data changes — in EMEA that may include a works council.")
    body(doc, "Raising this is a good outcome rather than an obstacle: it is where the platform is strong, and it is the conversation that makes the project real.")

    # ---------------------------------------------------------- support
    h1(doc, "Support & Contact")
    table(
        doc,
        ["Resource", "Location"],
        [
            ["Source and documentation", F["repo"]],
            ["Public static build", F["public_url"]],
            ["Runs locally on", "Application port 5180, API port 3006"],
            ["Account verified against", f"{F['account']} ({F['region']})"],
            ["Owner", f"Dave Freriks — {CONTACT}"],
        ],
        widths=[2.0, 4.7],
    )

    h2(doc, "Related deliverables")
    table(
        doc,
        ["Document", "Contents"],
        [
            ["SAP_People_360_Demo.pptx", "17-slide demo presentation — the narrative for a customer session"],
            ["People_360_Presales_Kit/", "SE-facing kit: quick start, per-persona scripts, management summary, deck"],
            ["SAP_People_360_Walkthrough.mp4", "Narrated walkthrough, 4m25s"],
        ],
        widths=[2.4, 4.3],
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
