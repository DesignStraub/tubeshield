# Changelog

## 1.2.0 – 2026-11-18
- **Alle Websites:** rund 93.000 Regeln aus EasyList, EasyPrivacy und EasyList Germany (vorher 47).
- Regeln auf zwei Regelsätze verteilt (`custom` + `filters`), damit der Grundschutz auch dann aktiv bleibt, wenn Safari die große Liste ablehnt.
- Neues Werkzeug `tools/update-filters.py` zum Aktualisieren der Listen.
- Neues Build-Skript `scripts/build.sh` (abgleichen, bauen, signieren, prüfen, installieren).

## 1.1.1 – 2026-11-18
- YouTube: Gelbe Werbe-Fortschrittsleiste, Steuerleiste und Werbe-Markierungen in der Zeitleiste während der Werbung ausgeblendet – ohne Überblend-Animation.

## 1.1.0 – 2026-11-18
- YouTube: Bei Werbung, die direkt in den Videostream eingebettet ist, wird nicht mehr ans Ende gesprungen (das hätte das eigentliche Video übersprungen). Stattdessen: stumm + 16-fache Geschwindigkeit.
- YouTube: Werbebild ist sofort unsichtbar, nicht erst nach dem nächsten Prüfzyklus.
- YouTube: Premium-Werbedialoge werden erkannt (korrekte Elementnamen `yt-upsell-dialog-renderer`, `yt-mealbar-promo-renderer`), ausgeblendet und über „Nein danke“ geschlossen.

## 1.0.0 – 2026-11-18
- Erste Version: Netzwerk-Blockieren, YouTube-Werbung überspringen, Auto-Pause-Block, Popup mit Schaltern.
