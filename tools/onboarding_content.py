#!/usr/bin/env python3
"""HR onboarding scenario content, shared by every People 360 kit builder.

One place for the scenario's wording so the START_HERE, quick start, persona
scripts, management summary, project guide and decks cannot drift apart. Every
figure comes from /tmp/people_facts.json (onb_hire, onb_kit, onb_replay), which
people_facts.py reads from the running app and the recorded run.
"""
from docx_kit import body, bullet, callout, h1, h2, table

PAGE = "Onboarding Scenario"
PURPOSE = ("New hire from SuccessFactors → equipment check → live web search for a "
           "substitute → simulated write-back")


def m(v, ccy="USD"):
    return f"${v:,.0f}" if ccy == "USD" else f"{v:,.0f} {ccy}"


def facts(F):
    h, k, r = F["onb_hire"], F["onb_kit"], F["onb_replay"]
    return h, k, r


def one_liner(F):
    h, k, _ = facts(F)
    return (f"A {h['title'].lower()} hire in {h['company']} is offered {m(h['salary'])} (grade {h['pay_grade']}, "
            f"derived from {h['peers']} peers); the {k['blocked_item']} is backordered {k['lead_days']} days, "
            f"so {k['lost_workdays']} idle workdays ≈ {m(k['idle_cost'])} — the app finds a priced substitute on "
            f"the live web and writes the hire back.")


def steps(F):
    h, k, r = facts(F)
    return [
        ["1. New hire", f"Offer derived from {h['peers']} active {h['title']} records in {h['company']}: "
                        f"{m(h['salary'])}, grade {h['pay_grade']}, {h['benefits_load_pct']}% benefits load → "
                        f"{m(h['daily_loaded'])} loaded cost per working day."],
        ["2. Equipment check", f"{k['on_time']} of {k['items']} kit items are in stock. The {k['blocked_item']} "
                               f"({k['blocked_spec']}) is {k['status'].lower()} at the preferred reseller, "
                               f"{k['lead_days']}-day lead → {k['lost_workdays']} idle workdays ≈ {m(k['idle_cost'])}."],
        ["3. Alternative sourcing", "Live web search for the same spec; Cortex AI_COMPLETE extracts vendor, model, "
                                    "price and ship time from the result pages. An offer is kept only if its price "
                                    "is on the cited page. Ranked by total impact = hardware + idle days × daily cost."],
        ["4. Substitute & write back", "Hire (PerPerson / EmpJob / EmpCompensation) and equipment request posted as "
                                       "SuccessFactors OData payloads, with the sourcing decision kept for audit — "
                                       "simulated: stored in Snowflake tables, not sent to a tenant."],
    ]


CAVEATS = [
    "The SuccessFactors write-back is **simulated**: the OData payloads are written to Snowflake tables "
    "(SF_WRITEBACK_EMPHIRE, SF_WRITEBACK_EQUIPMENT_REQUEST, SOURCING_DECISION), not posted to a tenant.",
    "Benefits plans, equipment kits, IT inventory and preferred sourcing are **demo enrichment**, not SAP data. "
    "The hire's pay and peer group come from the SAP BDC workforce share.",
    "Laptop offers come from a **live** web search and change on every run — never quote a vendor or price "
    "from a previous demo.",
    "Where it runs live: the local app, and the Native App **after the consumer approves the "
    "'Onboarding: web search' external-access specification**. The public github.io build replays one "
    "recorded run with inputs fixed.",
]


def where_it_runs(F):
    _, _, r = facts(F)
    return [
        ["Local app (localhost:5180)", "Live search, writes to SAP_PEOPLE_360.ONBOARDING", "Any role / company / date"],
        ["Native App (3 regions)", "Live search after approving the app's external-access spec; writes to the "
                                   "app's own ONBOARDING schema", "Any role / company / date"],
        ["Public build (github.io)", f"Replays the run recorded {r['recorded']} ({r['pages']} pages, "
                                     f"{r['offers']} offers, chose {r['chosen']})", "Fixed to that run"],
    ]


def docx_section(doc, F, heading="The HR onboarding scenario", level=1):
    """Full section: what it shows, the four steps, where it runs, what to say about its limits."""
    (h1 if level == 1 else h2)(doc, heading)
    body(doc, "The other pages report on the workforce. This one uses it: a hire is made from SuccessFactors data, "
              "a supply-chain disruption threatens their first day, and the app sources a substitute and closes the "
              "loop back to SuccessFactors — cost and time made explicit at every step.")
    callout(doc, "The line to say", one_liner(F))
    table(doc, ["Step", "What happens"], steps(F), widths=[1.6, 5.1])
    table(doc, ["Where", "Behaviour", "Inputs"], where_it_runs(F), widths=[1.7, 3.6, 1.4])
    for c in CAVEATS:
        bullet(doc, c, size=9.5)


def talk_track(F):
    """Short spoken path for a demo script: (click, say)."""
    h, k, _ = facts(F)
    return [
        ("Open Onboarding Scenario", f"The offer isn't typed in — it's derived from {h['peers']} peers: {m(h['salary'])}, "
                                     f"grade {h['pay_grade']}. Idle time costs {m(h['daily_loaded'])} a day."),
        ("Check onboarding equipment", f"Everything's in stock except the laptop: {k['lead_days']} days out, "
                                       f"{k['lost_workdays']} working days lost, about {m(k['idle_cost'])}."),
        ("Search the web for alternatives", "Live search; Cortex reads the pages. No price on the cited page, no offer."),
        ("Pick an offer", "Total impact counts the waiting, so a two-day machine usually wins. Spec match is flagged."),
        ("Substitute & write back", "Hire and equipment request go back to SuccessFactors — simulated here, payload kept in Snowflake."),
    ]
