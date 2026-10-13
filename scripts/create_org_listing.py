#!/usr/bin/env python3
"""
Create a region-scoped ORGANIZATION LISTING for the People 360 Native App.

Organization listings (organization_profile INTERNAL) publish the app to all
internal accounts in your org. Scoping access_regions to a SINGLE region avoids
cross-region auto-fulfillment (each region hosts its own governed install).

Prereqs (per account): package version registered + added to DEFAULT channel +
default release directive set (deploy_native_app.py does this).

Usage:
  python create_org_listing.py --target dfreriksdemo       --region PUBLIC.AWS_US_WEST_2
  python create_org_listing.py --target dfreriks_eu_demo   --region PUBLIC.AWS_EU_CENTRAL_1
  python create_org_listing.py --target dfreriks_apac_demo --region PUBLIC.AWS_AP_SOUTHEAST_2
"""
import argparse
import os
import snowflake.connector
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

PKG = "PEOPLE_360_PKG"
LISTING = "PEOPLE_360_ORG"
CONTACT = os.environ.get("LISTING_CONTACT", "you@example.com")
DESC = ("Self-contained SAP People 360 dashboard (React + Express on Snowpark "
        "Container Services) with bundled SAP SuccessFactors workforce data, a Cortex Analyst "
        "'Ask the Agent' page over the SAP_PEOPLE_360_ANALYTICS semantic view, and an HR "
        "onboarding scenario: a hire made from SuccessFactors data, a backordered laptop, "
        "live web sourcing of a priced substitute with Cortex AI_COMPLETE, and a simulated "
        "SuccessFactors write-back. No data setup required; approve the app's "
        "'Onboarding: web search' specification to run the scenario live. Synthetic data.")


def connect(conn_name, **kw):
    import tomllib
    with open(os.path.expanduser("~/.snowflake/connections.toml"), "rb") as f:
        cfg = tomllib.load(f)[conn_name]
    with open(cfg["private_key_path"], "rb") as f:
        pk = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())
    der = pk.private_bytes(serialization.Encoding.DER,
                           serialization.PrivateFormat.PKCS8,
                           serialization.NoEncryption())
    return snowflake.connector.connect(
        account=cfg["account"], user=cfg["user"], private_key=der,
        role=cfg.get("role", "ACCOUNTADMIN"), **kw)


def create(target, region, wh):
    manifest = f'''title: "SAP People 360"
description: "{DESC}"
organization_profile: "INTERNAL"
organization_targets:
  access:
  - all_internal_accounts: true
  discovery:
  - all_internal_accounts: true
locations:
  access_regions:
  - name: "{region}"
approver_contact: "{CONTACT}"
support_contact: "{CONTACT}"
request_approval_type: "REQUEST_AND_APPROVE_OUTSIDE_SNOWFLAKE"
resharing:
  enabled: false
'''
    conn = connect(target, warehouse=wh)
    cur = conn.cursor()
    cur.execute(f"USE WAREHOUSE {wh}")
    cur.execute(f"CREATE ORGANIZATION LISTING {LISTING} APPLICATION PACKAGE {PKG} "
                f"AS $$\n{manifest}$$ PUBLISH=TRUE")
    print(target, "->", cur.fetchone()[0])
    cur.execute(f"SHOW LISTINGS LIKE '{LISTING}'")
    cols = [c[0] for c in cur.description]
    row = dict(zip(cols, cur.fetchall()[0]))
    print("  locator:", row.get("uniform_listing_locator"), "| state:", row.get("state"))
    cur.close(); conn.close()


def update(target, wh):
    """Refresh the description on the live listing, keeping its contacts, targets and regions."""
    import yaml
    conn = connect(target, warehouse=wh)
    cur = conn.cursor()
    cur.execute(f"DESCRIBE LISTING {LISTING}")
    cols = [c[0].lower() for c in cur.description]
    row = dict(zip(cols, cur.fetchone()))
    man = yaml.safe_load(row["manifest_yaml"])
    before = man.get("description", "")
    man["description"] = DESC
    cur.execute(f"ALTER LISTING {LISTING} AS $$\n{yaml.safe_dump(man, sort_keys=False, width=1000)}$$")
    cur.execute(f"DESCRIBE LISTING {LISTING}")
    cols = [c[0].lower() for c in cur.description]
    after = dict(zip(cols, cur.fetchone()))
    ok = (yaml.safe_load(after["manifest_yaml"]) or {}).get("description") == DESC   # YAML may wrap the text
    print(f"{target}: {LISTING} description {'updated' if ok else 'NOT updated'} "
          f"(was {len(before)} chars, now {len(DESC)}) | state={after.get('state')}")
    cur.close(); conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True)
    ap.add_argument("--region", help="e.g. PUBLIC.AWS_US_WEST_2 (create only)")
    ap.add_argument("--update", action="store_true", help="refresh the description on the existing listing")
    ap.add_argument("--warehouse", default="COMPUTE_WH")
    a = ap.parse_args()
    update(a.target, a.warehouse) if a.update else create(a.target, a.region, a.warehouse)
