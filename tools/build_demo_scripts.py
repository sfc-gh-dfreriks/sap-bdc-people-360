#!/usr/bin/env python3
"""Build 02_Demo_Scripts_by_Persona.docx for SAP People 360.

Six standalone scripts. They are not variants of one walkthrough: each opens on a
different page, lands a different number, and expects different pushback. Pick the
one that matches the room.

Figures come from /tmp/people_facts.json (tools/people_facts.py).

    python3 tools/people_facts.py && python3 tools/build_demo_scripts.py
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

KIT = pathlib.Path.home() / "Documents" / "SAP" / "People_360_Presales_Kit"
FACTS_FILE = pathlib.Path("/tmp/people_facts.json")
DATE = date.today().strftime("%d %B %Y")


def load_facts() -> dict:
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


def script(doc, n, persona, minutes, audience, intro, steps, numbers, closing, questions):
    h1(doc, f"Script {n} · {persona}")
    body(doc, f"{minutes} minutes   ·   Audience: {audience}", italic=True)
    body(doc, intro)
    table(doc, ["Page", "Do and say", "Time"], steps, widths=[1.5, 4.5, 0.7])
    if numbers:
        h2(doc, "The numbers to land")
        for nline in numbers:
            bullet(doc, nline)
    h2(doc, "Closing line")
    callout(doc, "Say this", closing)
    h2(doc, "Questions to expect")
    for q, a in questions:
        body(doc, q, italic=True, after=2)
        body(doc, a)


def main() -> int:
    F = load_facts()
    k = F["kpis"]
    sv = next(iter(F["semantic_view_detail"].values()))
    w = F["data_windows"]
    ids = ", ".join(r["EMPLOYEE_ID"] for r in F["sample_employee_ids"])
    top_dept = F["headcount_by_department"][0]
    biggest_co = F["headcount_by_company"][0]

    KIT.mkdir(parents=True, exist_ok=True)
    doc = Document()
    setup_page(doc)
    title_block(
        doc,
        "SAP People 360",
        "Demo scripts by persona",
        f"{DATE}   ·   Six scripts, one per audience",
    )

    body(
        doc,
        "Each script opens on a different page and lands a different number. Running "
        "two back to back works only for scripts 1 and 2, which are built to pair.",
    )

    h1(doc, "Before any demo")
    bullet(doc, "Open the app once to warm the container; a cold first load looks slower than it is.")
    bullet(doc, "Reset the Department and Company filters to all — a stray selection makes charts look empty.")
    bullet(doc, f"Say the data is synthetic in the first minute. Identifiers are sequential ({ids}…) and no names appear anywhere.")
    bullet(doc, f"Know the windows: performance reviews cover {w['DT_PERFORMANCE']['min']}–{w['DT_PERFORMANCE']['max']}, everything else runs into 2026.")
    bullet(doc, "Remember the agent covers workforce only. Do not ask it about performance, learning or recruiting.")

    # ---------------------------------------------------------------- 1. CHRO
    script(
        doc, 1, "CHRO / HR Director", 8, "HR leadership and their staff",
        "The flagship script. It stays on the business question — where is retention "
        "risk and what is exposed — and never mentions a table name.",
        [
            ["Workforce Overview",
             f"Open on the headline: {k['active_headcount']:,} active, {k['attrition_pct']}% "
             f"attrition, ${k['avg_salary']:,} average base. Say these are SAP's own "
             f"definitions, not ones rebuilt in a spreadsheet.", "1 min"],
            ["Attrition",
             f"{F['terminations']} terminations by year, reason and department. Ask them "
             f"which department they would have guessed — it makes the point that guessing "
             f"is what happens today.", "2 min"],
            ["Org & Span",
             f"{F['critical_positions']} positions flagged critical. This is succession "
             f"exposure made visible rather than discussed.", "2 min"],
            ["Compensation",
             f"Compa-ratio average {F['avg_compa_ratio']}. Pay equity is usually the "
             f"question behind the retention question.", "1 min"],
            ["Ask the Agent",
             "Ask one question live — attrition rate by division works well — and show "
             "the SQL. The point is that HR can ask, not wait.", "2 min"],
        ],
        [
            f"{k['attrition_pct']}% attrition across {F['employees']:,} records",
            f"{F['critical_positions']} critical positions identified",
            f"{F['departments']} departments across {F['companies']} companies, largest {biggest_co['COMPANY']} at {biggest_co['EMPLOYEES']}",
        ],
        "Every number here came from your SuccessFactors data without anyone exporting "
        "an employee record — and the question you just asked out loud was answered "
        "while we were talking.",
        [
            ("Is this our data?",
             "No — it is synthetic, modelled on the real SuccessFactors field structure. "
             "The architecture is what you would run; the people are invented."),
            ("Who would be able to see salaries?",
             "Whoever you decide. Access is enforced in the platform rather than by who "
             "has the spreadsheet, and we would design that with you."),
            ("How long to see this on our own data?",
             "If your workforce data products are already shared into Snowflake, the "
             "layers above them are the deliverable — that is the scoping conversation."),
        ],
    )

    # ------------------------------------------------- 2. People Analytics lead
    script(
        doc, 2, "People Analytics lead", 7, "HR operations and analytics teams",
        "This persona does the work today and will judge whether it removes their "
        "bottleneck. Spend the time on the agent and on lineage.",
        [
            ["Ask the Agent",
             "Open here, not on the dashboard. Read one of the eight built-in questions, "
             "then type a variation of your own and expand the generated SQL.", "3 min"],
            ["BDC Sources & Lineage",
             "Show which SAP BDC objects feed each layer. This is the answer to 'where "
             "did this number come from', which is their daily problem.", "2 min"],
            ["Employees",
             "The record-level table, filterable. Shows they can still get to the grain "
             "when a question demands it.", "1 min"],
            ["Headcount",
             f"Close on breakdowns — {top_dept['DEPARTMENT']} is the largest department at "
             f"{top_dept['EMPLOYEES']}. Say the definitions came from SAP, so their number "
             f"and Finance's number agree for once.", "1 min"],
        ],
        [
            f"{sv['dimensions']} dimensions and {sv['facts']} facts in the governed model",
            f"{len(F['analytics_objects'])} analytics tables, {F['analytics_rows']:,} rows",
        ],
        "The work you do assembling an answer is the work this removes — and when "
        "someone challenges a number, the lineage and the SQL are both on screen.",
        [
            ("Can it answer anything about performance?",
             f"Not yet. The model covers the workforce table only "
             f"({', '.join(sv['table_names'])}). Performance, learning and recruiting are "
             f"on the dashboards. Extending the model is the obvious next increment and "
             f"it is small."),
            ("What happens when the agent gets it wrong?",
             "You see the SQL, so you can tell. It is constrained to the governed model "
             "rather than free-associating over raw tables, which is the reason the "
             "semantic layer exists."),
            ("Do I still need my extracts?",
             "For anything outside the model today, yes. The honest position is that this "
             "removes the common questions first."),
        ],
    )

    # ----------------------------------------------------------- 3. Total Rewards
    script(
        doc, 3, "Total Rewards / Compensation", 6, "Compensation and benefits",
        "One page carries this conversation. Be careful and precise: this audience "
        "knows compa-ratio better than you do.",
        [
            ["Compensation",
             f"Compa-ratio against range midpoint, averaging {F['avg_compa_ratio']}. "
             f"Say 1.0 means paid at midpoint, so the distribution is the story rather "
             f"than the average.", "3 min"],
            ["Diversity & Inclusion",
             f"Pay and representation together — {k['pct_female']}% female overall. "
             f"Present it without editorialising; the value is that it is measurable.", "2 min"],
            ["Ask the Agent",
             "Ask average salary by pay grade and gender. It is one of the eight built-in "
             "questions, so it will answer cleanly.", "1 min"],
        ],
        [
            f"average compa-ratio {F['avg_compa_ratio']}",
            f"${k['avg_salary']:,} average base salary across {k['active_headcount']:,} active employees",
        ],
        "A pay-equity review that takes a quarter to assemble can be a question you ask "
        "in a meeting — and the range midpoint it compares against is SAP's, not a "
        "number we invented.",
        [
            ("Whose midpoint is that?",
             "The pay range already held in SuccessFactors — minimum, midpoint and "
             "maximum come across with the record, so the comparison is not reconstructed."),
            ("Is this adjusted for tenure, location or performance?",
             "Not in this view. It is an unadjusted comparison, which is the right first "
             "screen but not a defensible equity conclusion on its own. Say so."),
            ("Could our comp team see individual salaries here?",
             "That is a policy decision enforced by masking and row access policies. "
             "Worth designing before anyone is given the URL."),
        ],
    )

    # ------------------------------------------------------ 4. Talent Acquisition
    script(
        doc, 4, "Talent Acquisition", 5, "Recruiting and talent leadership",
        "Lead with exposure, not with the requisition list — the hook is which roles "
        "are risky rather than which are open.",
        [
            ["Org & Span",
             f"{F['critical_positions']} critical positions. Start with risk: these are "
             f"the roles where one resignation becomes a gap.", "2 min"],
            ["Recruiting",
             "Requisitions by status: "
             + ", ".join(f"{r['REQS']} {r['STATUS'].lower()}" for r in F["recruiting_by_status"])
             + ". Connect open reqs back to the critical roles.", "2 min"],
            ["Attrition",
             "Termination reasons, to show demand is partly predictable rather than "
             "purely reactive.", "1 min"],
        ],
        [
            ", ".join(f"{r['REQS']} {r['STATUS'].lower()}" for r in F["recruiting_by_status"]),
            f"{F['critical_positions']} critical positions flagged",
        ],
        "Hiring demand stops being a queue you react to and becomes something you can "
        "see coming, because the risk and the requisitions sit on the same data.",
        [
            ("How current is the requisition data?",
             f"It runs to {w['DT_RECRUITING']['max']} in this dataset. Recruiting and "
             f"learning are more current than performance, which stops a year earlier."),
            ("Can the agent answer recruiting questions?",
             "Not today — recruiting is on the dashboard but outside the agent's model. "
             "Say it rather than let them discover it."),
            ("What makes a position critical?",
             "A flag on the record in the source system, not something we derived. Which "
             "means the definition is yours to change."),
        ],
    )

    # ------------------------------------------------------------ 5. Finance
    script(
        doc, 5, "Finance business partner", 5, "Finance partnering with HR",
        "Finance cares about workforce cost and about whether HR's numbers reconcile "
        "with theirs. Lead with the second point.",
        [
            ["Headcount",
             f"Headcount by company — {biggest_co['COMPANY']} largest at "
             f"{biggest_co['EMPLOYEES']}, average tenure {biggest_co['AVG_TENURE']} years. "
             f"Say the headcount definition is SAP's, so it matches what HR reports.", "2 min"],
            ["Compensation",
             f"Average base ${k['avg_salary']:,}. Useful for cost modelling by unit.", "2 min"],
            ["Attrition",
             f"{k['attrition_pct']}% attrition — the replacement-cost driver. Be careful: "
             f"this is terminations as a share of records, not an annualised rate.", "1 min"],
        ],
        [
            f"${k['avg_salary']:,} average base salary",
            f"{k['active_headcount']:,} active headcount across {F['companies']} companies",
        ],
        "When HR and Finance disagree about headcount it is almost always because the "
        "definitions diverged downstream. Here there is one definition, and it came "
        "from SAP.",
        [
            ("Is that attrition figure annualised?",
             "No — it is terminations as a share of all records in the dataset. An "
             "annualised rate needs a period denominator this view does not impose. Do "
             "not let it be quoted as an annual rate."),
            ("Does this include contractors?",
             "Employee type and employment type are both on the record, so it can be "
             "split — but the headline figure here does not separate them."),
            ("Can we join this to actual payroll cost?",
             "Not in this dataset. It is the natural extension once workforce and finance "
             "data products are both shared in."),
        ],
    )

    # ---------------------------------------------------------- 6. Architect
    script(
        doc, 6, "Enterprise / Data Architect", 7, "Architecture and data platform",
        "This persona wants to know the trick. There isn't one: show the layers and "
        "be candid about what is not built.",
        [
            ["BDC Sources & Lineage",
             "Open here. Zero copy from the BDC share, an L1 view, then the analytics "
             "layer. No pipeline and no second copy of employee data.", "2 min"],
            ["Ask the Agent",
             "Expand the generated SQL. The agent is bound to a semantic view, not "
             "pointed at raw tables.", "2 min"],
            ["Employees",
             "Record-level access exists, which is the cue to talk about masking and row "
             "access policies enforced in the platform.", "1 min"],
            ["—",
             f"Be straight about the seams: {len(F['dynamic_tables'])} of "
             f"{len(F['analytics_objects'])} analytics tables is a dynamic table, the rest "
             f"are static; and the semantic model covers one table so far. Architects "
             f"trust you more for saying it.", "2 min"],
        ],
        [
            f"{len(F['dynamic_tables'])} dynamic table, {len(F['dt_prefixed_not_dynamic'])} static base tables",
            f"semantic view: {sv['tables']} table, {sv['dimensions']} dimensions, {sv['facts']} facts",
        ],
        "Nothing here required moving employee data out of SAP, and the governance that "
        "decides who sees compensation is enforced by the platform rather than by "
        "convention.",
        [
            ("Why is only one of the analytics tables dynamic?",
             "Because the other three were built as static loads. A DT_ prefix is naming "
             "convention, not a guarantee — SHOW DYNAMIC TABLES is the check. For live "
             "data they should all be dynamic with an explicit target lag."),
            ("What is the refresh story end to end?",
             "The share updates at source; the dynamic table has a downstream lag, which "
             "means it refreshes when something asks. For production you would set an "
             "explicit lag rather than rely on that."),
            ("How would you secure this properly?",
             "Masking policies on compensation columns, row access policies keyed to the "
             "manager hierarchy, and a role model that separates HR business partners "
             "from analysts. That is a design exercise, and it is the right next step."),
        ],
    )

    out = KIT / "02_Demo_Scripts_by_Persona.docx"
    doc.save(out)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
