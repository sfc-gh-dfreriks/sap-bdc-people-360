#!/usr/bin/env python3
"""Build SAP_People_360_Demo.pptx — the customer-facing demo deck.

Follows the shape of SAP_Finance_360_Demo.pptx so the domains read as a set:
title, overview, challenge, solution, by-the-numbers, demo flow, a walkthrough
section with one slide per page group, a technical architecture section,
deployment options, and a close. Seventeen slides on the shared Snowflake
template, checked by the shared verifier.

Figures come from /tmp/people_facts.json and screenshots from /tmp/people_shots,
so neither can drift from the account or the application.

    python3 tools/people_facts.py
    python3 ../sap-bdc-finance-360/tools/capture_shots.py --app people
    python3 tools/build_demo_deck.py
"""
from __future__ import annotations

import json
import pathlib
import sys

from PIL import Image
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_AUTO_SIZE, PP_ALIGN
from pptx.util import Inches, Pt

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pptx_kit import (  # noqa: E402
    BODY_GREY, DK1, DK2, LIGHT_BG, SF_BLUE, TEAL, VIOLET, WHITE,
    add_shape_text, new_presentation, set_ph, verify_deck, verify_slide,
)
from pptx.dml.color import RGBColor  # noqa: E402

RED = RGBColor(0xA2, 0x00, 0x00)

FACTS = pathlib.Path("/tmp/people_facts.json")
SHOTS = pathlib.Path("/tmp/people_shots")
OUT = pathlib.Path.home() / "Documents" / "SAP" / "SAP_People_360_Demo.pptx"

TOP, BOTTOM, LEFT, RIGHT = 1.32, 5.08, 0.40, 9.50
FULLW = RIGHT - LEFT

CONTACT = "dave.freriks@snowflake.com"


def load():
    f = json.loads(FACTS.read_text())["facts"]
    shots = {}
    man = SHOTS / "manifest.json"
    if man.exists():
        shots = {s["id"]: s["file"] for s in json.loads(man.read_text())
                 if pathlib.Path(s["file"]).exists()}
    return f, shots


# ----------------------------------------------------------------- helpers
# Same helper set as the sibling deck builders, so layouts match across domains.


def content(prs, title, subtitle):
    s = prs.slides.add_slide(prs.slide_layouts[0])
    set_ph(s, 0, title)
    set_ph(s, 1, subtitle)
    return s


def section(prs, kicker, title, lines):
    s = prs.slides.add_slide(prs.slide_layouts[0])
    set_ph(s, 0, title)
    set_ph(s, 1, kicker)
    y = TOP + 0.15
    for ln in lines:
        add_shape_text(s, MSO_SHAPE.RECTANGLE, LEFT, y, 0.055, 0.30, "", SF_BLUE, DK1)
        stack(s, LEFT + 0.26, y + 0.02, FULLW - 0.4, 0.28, [(ln, 13, False, DK1, 0)])
        y += 0.46
    return s


def box(slide, x, y, w, h, fill=LIGHT_BG, accent=None):
    add_shape_text(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, "", fill, DK1)
    if accent is not None:
        add_shape_text(slide, MSO_SHAPE.RECTANGLE, x, y, 0.05, h, "", accent, DK1)


def stack(slide, x, y, w, h, runs, align=PP_ALIGN.LEFT, spacing=1.06):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    for i, item in enumerate(runs):
        body, size, bold, colour = item[:4]
        after = item[4] if len(item) > 4 else 5
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        p.space_after = Pt(after)
        r = p.add_run()
        r.text = body
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = colour
        r.font.name = "Arial"
    return tb


def card(slide, x, y, w, h, kicker, runs, accent=DK2, fill=LIGHT_BG):
    box(slide, x, y, w, h, fill, accent)
    head = [(kicker.upper(), 8.5, True, DK2, 7)] if kicker else []
    stack(slide, x + 0.24, y + 0.16, w - 0.42, h - 0.30, head + list(runs))


def banner(slide, y, runs, fill=DK2, h=0.62, x=LEFT, w=FULLW):
    add_shape_text(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, "", fill, WHITE)
    stack(slide, x + 0.30, y + 0.11, w - 0.60, h - 0.22, runs)


def stat(slide, x, y, w, h, value, label, detail=None, accent=DK2):
    box(slide, x, y, w, h, LIGHT_BG, accent)
    runs = [(value, 26, True, DK2, 3), (label.upper(), 8.5, True, BODY_GREY, 4)]
    if detail:
        runs.append((detail, 9.5, False, DK1, 0))
    stack(slide, x + 0.24, y + 0.15, w - 0.44, h - 0.28, runs)


def note(slide, text, y=4.88):
    stack(slide, LEFT, y, FULLW, 0.19, [(text, 8, False, BODY_GREY, 0)])


def picture(slide, path, x, y, w, h):
    im = Image.open(path)
    ar = im.width / im.height
    if ar > w / h:
        pw, ph = w, w / ar
    else:
        ph, pw = h, h * ar
    slide.shapes.add_picture(str(path), Inches(x + (w - pw) / 2),
                             Inches(y + (h - ph) / 2), Inches(pw), Inches(ph))


def grid(slide, rows, y0=TOP, rh=0.50, widths=(4.55, 4.15), size=10.5):
    y = y0
    for i, (a, b) in enumerate(rows):
        box(slide, LEFT, y, FULLW, rh, LIGHT_BG if i % 2 == 0 else WHITE, None)
        stack(slide, LEFT + 0.24, y + 0.13, widths[0], rh - 0.26, [(a, size, True, DK1, 0)])
        stack(slide, LEFT + 0.30 + widths[0], y + 0.13, widths[1], rh - 0.26,
              [(b, size, False, BODY_GREY, 0)])
        y += rh + 0.06
    return y


# ------------------------------------------------------------------ slides


def s01_title(prs, f):
    s = prs.slides.add_slide(prs.slide_layouts[13])
    set_ph(s, 3, "SAP BDC PEOPLE 360")
    set_ph(s, 0, "Workforce Analytics on SAP BDC Data using BDC Connect Zero Copy")
    set_ph(s, 2, f"Demo deck · {CONTACT}")
    return s


def s02_overview(prs, f):
    k = f["kpis"]
    s = content(prs, "The organisation", "A global employer, modelled from SAP data in place")
    w = (FULLW - 0.3) / 4
    for i, (v, lab, det, ac) in enumerate([
        (f"{k['active_headcount']:,}", "active employees", f"of {f['employees']:,} records", SF_BLUE),
        (f"{f['departments']}", "departments", f"across {f['companies']} companies", TEAL),
        (f"${k['avg_salary']:,}", "average base pay", f"compa-ratio {f['avg_compa_ratio']}", VIOLET),
        (f"{f['critical_positions']}", "critical positions", "succession exposure", DK2),
    ]):
        stat(s, LEFT + i * (w + 0.10), TOP, w, 1.05, v, lab, det, accent=ac)
    cos = " · ".join(f"{c['COMPANY']} {c['EMPLOYEES']}" for c in f["headcount_by_company"])
    card(s, LEFT, TOP + 1.25, FULLW, 1.20, "how it breaks down", [
        (f"{cos}. Average tenure {f['headcount_by_company'][0]['AVG_TENURE']} years. "
         f"Every figure comes from SAP's own definitions of headcount, tenure and "
         f"compa-ratio rather than being rebuilt in a spreadsheet downstream.",
         12, False, DK1, 0)], accent=SF_BLUE)
    banner(s, TOP + 2.62, [
        ("The people are synthetic — a demo database with sequential identifiers and no "
         "names anywhere in the analytics layer.", 12, True, WHITE, 0)], h=0.56)
    return s


def s03_challenge(prs):
    s = content(prs, "The challenge", "HR questions that should take minutes take weeks")
    card(s, LEFT, TOP, 4.4, 1.55, "what HR gets asked", [
        ("Where is attrition concentrated? Is pay equitable across grade and gender? "
         "Which critical roles are one resignation from a gap?", 12, False, DK1, 0)],
        accent=SF_BLUE)
    card(s, LEFT + 4.7, TOP, 4.4, 1.55, "why it is slow", [
        ("The data sits in SuccessFactors behind an extract request, and each extract "
         "gets remodelled in a spreadsheet — so headcount stops matching SAP.",
         12, False, DK1, 0)], accent=RED)
    grid(s, [
        ("Nobody wants employee pay copied", "so the analysis gets narrowed instead of governed"),
        ("Definitions drift on the way out", "HR and Finance then disagree about headcount"),
        ("The answer arrives after the decision", "which makes it reporting, not analytics"),
    ], y0=TOP + 1.75, rh=0.46)
    banner(s, 4.28, [
        ("The blocker is not analytics capability. It is that moving HR data anywhere is "
         "the part nobody wants to own.", 12, True, WHITE, 0)], h=0.52)
    return s


def s04_solution(prs, f):
    s = content(prs, "The solution", "BDC Connect shares the data; nothing is copied")
    card(s, LEFT, TOP, 4.4, 1.80, "no pipeline", [
        ("BDC Connect shares the workforce data product straight into Snowflake with "
         "zero copy. Between the share and the app there is exactly one view — not a "
         "copy. There is no ingestion step to break.", 12, False, DK1, 0)], accent=TEAL)
    card(s, LEFT + 4.7, TOP, 4.4, 1.80, "no re-derived metrics", [
        ("Tenure, compa-ratio and headcount arrive as SAP defines them. The pay range "
         "midpoint that compa-ratio compares against comes across with the record.",
         12, False, DK1, 0)], accent=SF_BLUE)
    banner(s, TOP + 2.00, [
        ("And the governance that decides who may see compensation is enforced by the "
         "platform, not by who holds the spreadsheet.", 12, True, WHITE, 0)], h=0.58)
    note(s, "SAP BDC is included in a RISE with SAP subscription at no additional cost.")
    return s


def s05_numbers(prs, f):
    k = f["kpis"]
    sv = next(iter(f["semantic_view_detail"].values()))
    s = content(prs, "People 360 by the numbers", "Read from the platform, not from a previous deck")
    w = (FULLW - 0.3) / 4
    for i, (v, lab, det, ac) in enumerate([
        (f"{f['employees']:,}", "employee records", f"{k['active_headcount']:,} active", SF_BLUE),
        (f"{k['attrition_pct']}%", "attrition shown", f"{f['terminations']} terminations", RED),
        (f"{k['pct_female']}%", "female", f"{k['pct_managers']}% are managers", VIOLET),
        (f"{f['avg_compa_ratio']}", "average compa-ratio", "1.0 = paid at midpoint", TEAL),
    ]):
        stat(s, LEFT + i * (w + 0.10), TOP, w, 1.02, v, lab, det, accent=ac)
    for i, (v, lab, det, ac) in enumerate([
        (f"{f['analytics_rows']:,}", "rows in analytics", f"{len(f['analytics_objects'])} tables", DK2),
        (f"{sum(r['REVIEWS'] for r in f['performance_distribution']):,}", "performance reviews", "2024 to 2025", SF_BLUE),
        (f"{f['learning_completions']:,}", "learning completions", f"of {f['analytics_objects'][0]['ROW_COUNT']:,} records", TEAL),
        (f"{[r['REQS'] for r in f['recruiting_by_status'] if r['STATUS']=='Open'][0]}", "open requisitions", "of 160 total", VIOLET),
    ]):
        stat(s, LEFT + i * (w + 0.10), TOP + 1.20, w, 1.02, v, lab, det, accent=ac)
    banner(s, TOP + 2.42, [
        (f"Attrition here is terminations as a share of all records — not an annualised "
         f"rate. Quoting it as annual attrition would be wrong.", 11.5, True, WHITE, 0)],
        h=0.54)
    return s


def s06_flow(prs):
    s = content(prs, "Demo flow", "About ten minutes, opening on the question HR actually brings")
    grid(s, [
        ("1 · Workforce Overview", "headcount, attrition, pay and gender in one screen"),
        ("2 · Attrition", "where it is concentrated, by reason and department"),
        ("3 · Compensation", "compa-ratio against the band SAP already holds"),
        ("4 · Org & Span", "critical positions — succession exposure made visible"),
        ("5 · Ask the Agent", "a plain-English question, with the SQL shown"),
        ("6 · BDC Sources & Lineage", "the zero-copy proof, inside the app"),
    ], y0=TOP, rh=0.52)
    note(s, "Say the data is synthetic in the first minute. On HR data, do not wait to be challenged on it.")
    return s


def s07_walkthrough_section(prs):
    return section(
        prs, "LIVE DEMO WALKTHROUGH", "Twelve pages, six acts",
        ["Workforce Overview — the headline numbers",
         "Attrition — where retention risk sits",
         "Compensation — pay against the band",
         "Org & Span — succession exposure",
         "Ask the Agent — natural language, and its limit",
         "Sources & Lineage — zero copy, visible in the app"],
    )


def s08_overview_page(prs, f, shots):
    k = f["kpis"]
    s = content(prs, "Workforce Overview", "One screen, and the questions it already answers")
    if "overview" in shots:
        picture(s, shots["overview"], LEFT, TOP, 5.9, 3.4)
    x = LEFT + 6.1
    stat(s, x, TOP, 3.0, 0.80, f"{k['active_headcount']:,}", "active headcount", None, accent=SF_BLUE)
    stat(s, x, TOP + 0.90, 3.0, 0.80, f"{k['attrition_pct']}%", "attrition", f"{f['terminations']} terminations", accent=RED)
    stat(s, x, TOP + 1.80, 3.0, 0.80, f"${k['avg_salary']:,}", "average base", None, accent=TEAL)
    stat(s, x, TOP + 2.70, 3.0, 0.70, f"{k['pct_female']}%", "female", None, accent=VIOLET)
    note(s, "Department and Company filters apply across every page.")
    return s


def s09_attrition(prs, f, shots):
    # The rate lives in the KPI block, not on the facts root: the root carries
    # attrition_pct_of_records, which is the same number under a longer name.
    k = f["kpis"]
    s = content(prs, "Attrition", "The page HR leadership leans into")
    if "attrition" in shots:
        picture(s, shots["attrition"], LEFT, TOP, 5.9, 3.4)
    card(s, LEFT + 6.1, TOP, 3.0, 1.60, "what it answers", [
        (f"{f['terminations']} terminations by year, reason and department. Ask the room "
         f"which department they would have guessed — guessing is what happens today.",
         10.5, False, DK1, 0)], accent=RED)
    card(s, LEFT + 6.1, TOP + 1.75, 3.0, 1.65, "read it carefully", [
        (f"{k['attrition_pct']}% is terminations over all records, not an annualised "
         f"rate. An annual figure needs a period denominator this view does not impose.",
         10.5, False, DK1, 0)], accent=DK2)
    return s


def s10_compensation(prs, f, shots):
    s = content(prs, "Compensation", "Pay equity becomes measurable")
    if "compensation" in shots:
        picture(s, shots["compensation"], LEFT, TOP, 5.9, 3.4)
    card(s, LEFT + 6.1, TOP, 3.0, 1.60, "whose midpoint", [
        ("The pay range already held in SuccessFactors — minimum, midpoint and maximum "
         "come across with the record, so the comparison is not reconstructed.",
         10.5, False, DK1, 0)], accent=TEAL)
    stat(s, LEFT + 6.1, TOP + 1.75, 3.0, 0.78, f"{f['avg_compa_ratio']}", "average compa-ratio",
         "1.0 = paid at midpoint", accent=TEAL)
    card(s, LEFT + 6.1, TOP + 2.70, 3.0, 0.95, "be precise", [
        ("Unadjusted for tenure or location — a first screen, not a conclusion.",
         10, False, DK1, 0)], accent=DK2)
    return s


def s11_org(prs, f, shots):
    s = content(prs, "Org & Span", "Succession exposure, made visible")
    if "org" in shots:
        picture(s, shots["org"], LEFT, TOP, 5.9, 3.4)
    stat(s, LEFT + 6.1, TOP, 3.0, 0.85, f"{f['critical_positions']}", "critical positions",
         "flagged on the record", accent=RED)
    card(s, LEFT + 6.1, TOP + 0.95, 3.0, 1.25, "why it lands", [
        ("These are the roles where one resignation becomes a gap — a worry usually "
         "raised in a meeting, here measured.", 10.5, False, DK1, 0)], accent=SF_BLUE)
    rec = ", ".join(f"{r['REQS']} {r['STATUS'].lower()}" for r in f["recruiting_by_status"])
    card(s, LEFT + 6.1, TOP + 2.32, 3.0, 1.08, "read with recruiting", [
        (f"{rec} — hiring demand stops being a queue you react to.", 10.5, False, DK1, 0)],
        accent=VIOLET)
    return s


def s12_agent(prs, f, shots):
    sv = next(iter(f["semantic_view_detail"].values()))
    s = content(prs, "Ask the Agent", "Plain English, with the SQL shown")
    if "analyst" in shots:
        picture(s, shots["analyst"], LEFT, TOP, 5.5, 3.4)
    qs = f["agent_questions"][:5]
    stack(s, LEFT + 5.75, TOP - 0.02, 3.4, 1.85,
          [(f"· {q}", 9.5, False, DK1, 5) for q in qs])
    card(s, LEFT + 5.75, TOP + 1.95, 3.4, 1.45, "the limit to state", [
        (f"The semantic view carries one table ({', '.join(sv['table_names'])}), so the "
         f"agent answers workforce questions only. Performance, learning and recruiting "
         f"are dashboard-only.", 10, False, DK1, 0)], accent=RED)
    note(s, f"{sv['dimensions']} dimensions · {sv['facts']} facts · {sv['verified_queries']} verified queries — adding verified queries is the first production step.")
    return s


def s13_arch_section(prs):
    return section(
        prs, "TECHNICAL ARCHITECTURE", "BDC Connect to agent, in five layers",
        ["Zero copy in from SAP Business Data Cloud",
         "One passthrough view, not a second copy",
         "Four analytics tables, one governed semantic view",
         "A Cortex Agent, and a Native App with data bundled"],
    )


def s14_dataflow(prs, f):
    sv_fqn, sv = next(iter(f["semantic_view_detail"].items()))
    s = content(prs, "Technical data flow", "Everything above the share is Snowflake-native")
    layers = [
        ("L0", "SAP BDC workforce data product", "Shared zero-copy via BDC Connect, treated as immutable", TEAL),
        ("L1", "SAP BDC L1 · Workforce view", "A passthrough view — no ingestion step exists to break", SF_BLUE),
        ("L2", f"Analytics — {len(f['analytics_objects'])} tables, {f['analytics_rows']:,} rows",
         "Workforce, performance, learning, recruiting", SF_BLUE),
        ("SEM", "SAP People 360 Analytics semantic view",
         f"{sv['tables']} table · {sv['dimensions']} dimensions · {sv['facts']} facts", VIOLET),
        ("AI", "SAP People Analyst agent", "Cortex Agent, and Cortex Analyst inside the app", VIOLET),
        ("APP", f"Native App — {f['app_page_count']} pages", "React and Express on SPCS, data bundled", DK2),
    ]
    y = TOP
    for tag, name, detail, accent in layers:
        tag_text = DK1 if accent is TEAL else WHITE
        add_shape_text(s, MSO_SHAPE.RECTANGLE, LEFT, y, 0.62, 0.50, tag, accent, tag_text, 11, True)
        box(s, LEFT + 0.68, y, FULLW - 0.68, 0.50, LIGHT_BG, None)
        stack(s, LEFT + 0.88, y + 0.06, FULLW - 1.1, 0.40, [
            (f"{name} — {detail}", 10, True, DK1, 0)])
        y += 0.58
    note(s, "SuccessFactors remains the source of record. No employee data is extracted or duplicated.")
    return s


def s15_caveats(prs, f):
    s = content(prs, "What is real, and what is a demo", "Say this before you are asked")
    ids = ", ".join(r["EMPLOYEE_ID"] for r in f["sample_employee_ids"])
    rows = [
        ("Architecture, semantic view, agent, app", "Real — this is what would be deployed"),
        ("SuccessFactors field structure", "Real — modelled on SAP BDC workforce products"),
        ("The people, their pay and ratings", f"Synthetic — demo database, IDs like {ids}"),
        ("Names in the analytics layer", "None surfaced anywhere"),
        (f"Refresh — {len(f['dynamic_tables'])} of {len(f['analytics_objects'])} tables is dynamic",
         "The other three carry the prefix but never refresh"),
    ]
    y = grid(s, rows, y0=TOP, rh=0.50)
    wd = f["data_windows"]
    card(s, LEFT, y + 0.04, FULLW, 0.72, "windows differ by table", [
        (f"hires to {wd['DT_WORKFORCE_360']['max']} · learning to {wd['DT_LEARNING']['max']} · "
         f"recruiting to {wd['DT_RECRUITING']['max']} · reviews "
         f"{wd['DT_PERFORMANCE']['min']} to {wd['DT_PERFORMANCE']['max']}",
         10, False, DK1, 0)], accent=RED)
    note(s, "Performance reviews stop a year before the rest — the window most likely to catch someone out.")
    return s


def s16_deployment(prs, f):
    s = content(prs, "Deployment options", "Three routes, depending on who is in the room")
    grid(s, [
        ("Native App listing", "install, open, present — data bundled, nothing to configure"),
        ("Public static build", "credential-free for rehearsal; the agent will not answer"),
        ("Snowflake Intelligence only", "the agent and semantic view, no application needed"),
    ], y0=TOP, rh=0.52)
    regions = " · ".join(r.get("region", "—").split(".")[-1].replace("_", "-").lower()
                         for r in f["regions"] if "error" not in r)
    card(s, LEFT, TOP + 1.80, FULLW, 1.20, "published in three regions", [
        (f"{regions}. Each is an independent governed install of the same definition — "
         f"there is no cross-region querying, and for workforce data that separation is "
         f"a feature. Note that People 360 ships the app listing only; there is no "
         f"data-share listing today.", 11, False, DK1, 0)], accent=SF_BLUE)
    note(s, f"{f['app_listing']} · public build at {f['public_url']}")
    return s


def s17_close(prs):
    s = prs.slides.add_slide(prs.slide_layouts[13])
    set_ph(s, 3, "THANK YOU")
    set_ph(s, 0, "No employee data was copied to make this work")
    set_ph(s, 2, f"Questions — {CONTACT}")
    return s


def main():
    f, shots = load()
    if not shots:
        print("  note: no screenshots found — slides render without them")
    prs = new_presentation()

    slides = [
        s01_title(prs, f),
        s02_overview(prs, f),
        s03_challenge(prs),
        s04_solution(prs, f),
        s05_numbers(prs, f),
        s06_flow(prs),
        s07_walkthrough_section(prs),
        s08_overview_page(prs, f, shots),
        s09_attrition(prs, f, shots),
        s10_compensation(prs, f, shots),
        s11_org(prs, f, shots),
        s12_agent(prs, f, shots),
        s13_arch_section(prs),
        s14_dataflow(prs, f),
        s15_caveats(prs, f),
        s16_deployment(prs, f),
        s17_close(prs),
    ]

    issues = 0
    for n, s in enumerate(slides, 1):
        found = verify_slide(s, prs, n)
        for msg in found:
            print(f"  slide {n}: {msg}")
        issues += len(found)
    issues += len(verify_deck(prs))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(f"\nwrote {OUT}  ({len(prs.slides)} slides, {issues} verifier issue(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
