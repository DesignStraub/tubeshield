#!/usr/bin/env python3
"""
TubeShield – Filterlisten in Safari-Regeln (declarativeNetRequest) umwandeln.

Lädt EasyList, EasyPrivacy und EasyList Germany herunter, übernimmt daraus nur
die einfachen, robusten Netzwerk-Regeln der Form

    ||domain.tld^                     (alles von dieser Domain blockieren)
    ||domain.tld^$third-party         (nur wenn von fremder Seite geladen)
    ||domain.tld^$script,image,...    (nur bestimmte Ressourcentypen)

und schreibt sie nach extension/rules/filters.json. Die eigenen Regeln aus
tools/custom-rules.txt landen getrennt in extension/rules/custom.json – so
bleibt der Grundschutz aktiv, selbst wenn Safari den großen Regelsatz einmal
ablehnen sollte. Komplexere Regeln (Pfad-Muster, $domain=, Regex,
Element-Ausblendung) werden bewusst übersprungen: Sie verursachen am ehesten
kaputte Seiten. Einfache Ausnahmen (@@||domain^) aus den Listen werden
berücksichtigt – solche Domains werden nicht blockiert.

Nutzung:  python3 tools/update-filters.py
          python3 tools/update-filters.py --update-file PFAD
              schreibt nur die kompakte Update-Datei, die die installierte
              Erweiterung täglich lädt (erzeugt von der GitHub Action
              .github/workflows/filters.yml), und lässt extension/ unverändert.
Nur Python-Standardbibliothek, keine Abhängigkeiten.
"""

import argparse
import datetime
import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CUSTOM = ROOT / "tools" / "custom-rules.txt"
OUTPUT_CUSTOM = ROOT / "extension" / "rules" / "custom.json"
OUTPUT_FILTERS = ROOT / "extension" / "rules" / "filters.json"

LISTS = [
    ("EasyList", "https://easylist.to/easylist/easylist.txt"),
    ("EasyPrivacy", "https://easylist.to/easylist/easyprivacy.txt"),
    ("EasyList Germany", "https://easylist.to/easylistgermany/easylistgermany.txt"),
]

# Safari erlaubt 150.000 Regeln pro Erweiterung; wir bleiben deutlich darunter.
MAX_RULES = 100_000

# Hauptseiten (main_frame) werden nie blockiert – nur eingebettete Inhalte.
ALL_TYPES = ["sub_frame", "stylesheet", "script", "image", "font",
             "xmlhttprequest", "ping", "media", "websocket", "other"]

TYPE_MAP = {
    "script": "script", "image": "image", "stylesheet": "stylesheet",
    "css": "stylesheet", "subdocument": "sub_frame", "frame": "sub_frame",
    "xmlhttprequest": "xmlhttprequest", "xhr": "xmlhttprequest",
    "media": "media", "font": "font", "ping": "ping", "beacon": "ping",
    "websocket": "websocket", "other": "other",
}

DOMAIN_RULE = re.compile(r"^\|\|([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\^(?:\$(.+))?$")
PATH_RULE = re.compile(r"^\|\|([a-z0-9][a-z0-9.-]*\.[a-z]{2,}/[A-Za-z0-9_./-]*)$")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "TubeShield-filter-updater"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse(text, allow_paths=False):
    """Gibt (blocks, exceptions) zurück. blocks: Liste von (filter, types, third_party)."""
    blocks, exceptions = [], set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(("!", "[")):
            continue
        if "##" in line or "#@#" in line or "#?#" in line or "#$#" in line:
            continue  # Element-Ausblendung – nicht unterstützt

        if line.startswith("@@"):
            m = DOMAIN_RULE.match(line[2:])
            if m and not m.group(2):
                exceptions.add(m.group(1))
            continue

        if allow_paths:
            pm = PATH_RULE.match(line)
            if pm:
                blocks.append(("||" + pm.group(1), None, False))
                continue

        m = DOMAIN_RULE.match(line)
        if not m:
            continue
        domain, opts = m.group(1), m.group(2)
        types, third_party, ok = set(), False, True
        if opts:
            for opt in opts.split(","):
                opt = opt.strip().lower()
                if opt in ("third-party", "3p"):
                    third_party = True
                elif opt in TYPE_MAP:
                    types.add(TYPE_MAP[opt])
                else:
                    ok = False  # unbekannte/negierte Option -> Regel überspringen
                    break
        if ok:
            blocks.append(("||" + domain + "^", tuple(sorted(types)) or None, third_party))
    return blocks, exceptions


def domain_of(filt):
    return filt[2:].split("^")[0].split("/")[0]


def is_excepted(domain, exceptions):
    parts = domain.split(".")
    return any(".".join(parts[i:]) in exceptions for i in range(len(parts) - 1))


def write_update_file(path, rules):
    """Kompaktes Format für die Auto-Aktualisierung: [filter, drittanbieter, typen]."""
    compact = []
    for r in rules:
        cond = r["condition"]
        types = cond["resourceTypes"]
        compact.append([cond["urlFilter"],
                        1 if cond.get("domainType") == "thirdParty" else 0,
                        "" if types == ALL_TYPES else ",".join(sorted(types))])
    data = {"format": 1,
            "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "rules": compact}
    Path(path).write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(compact):>6} Regeln -> {path}", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--update-file", help="nur die Update-Datei für die Auto-Aktualisierung schreiben")
    args = ap.parse_args()

    custom_blocks, _ = parse(CUSTOM.read_text(encoding="utf-8"), allow_paths=True)

    list_blocks, exceptions, stats = [], set(), []
    for name, url in LISTS:
        print(f"Lade {name} …", file=sys.stderr)
        try:
            b, e = parse(fetch(url))
        except Exception as exc:  # Netzwerkfehler: abbrechen statt halbe Liste schreiben
            sys.exit(f"Fehler beim Laden von {name}: {exc}")
        stats.append((name, len(b)))
        list_blocks += b
        exceptions |= e

    seen = set()

    def build(blocks, limit):
        rules = []
        for filt, types, third_party in blocks:
            if filt in seen:
                continue
            if filt.endswith("^") and is_excepted(domain_of(filt), exceptions):
                continue
            seen.add(filt)
            cond = {"urlFilter": filt, "resourceTypes": list(types) if types else ALL_TYPES}
            if third_party:
                cond["domainType"] = "thirdParty"
            rules.append({"id": len(rules) + 1, "priority": 1,
                          "action": {"type": "block"}, "condition": cond})
            if len(rules) >= limit:
                print(f"Limit von {limit} Regeln erreicht – Rest übersprungen.", file=sys.stderr)
                break
        return rules

    custom_rules = build(custom_blocks, MAX_RULES)
    filter_rules = build(list_blocks, MAX_RULES - len(custom_rules))

    if args.update_file:
        write_update_file(args.update_file, filter_rules)
        return

    for path, rules in ((OUTPUT_CUSTOM, custom_rules), (OUTPUT_FILTERS, filter_rules)):
        path.write_text(json.dumps(rules, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{len(rules):>6} Regeln -> {path.relative_to(ROOT)}", file=sys.stderr)
    for name, n in stats:
        print(f"  {name}: {n} einfache Regeln", file=sys.stderr)
    print(f"  Ausnahmen berücksichtigt: {len(exceptions)}", file=sys.stderr)


if __name__ == "__main__":
    main()
