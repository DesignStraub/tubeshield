# Changelog

## 1.3.1 – 2026-11-19
- Shorts ausblenden: Eintrag „Shorts“ verschwindet jetzt auch in der eingeklappten Seitenleiste.

## 1.3.0 – 2026-11-19
- Neuer Schalter **Startseite ohne Vorschläge:** Die YouTube-Startseite zeigt keinen Feed mehr, nur noch Suche und Seitenleiste.
- Neuer Schalter **Shorts ausblenden:** Shorts verschwinden von der Startseite, aus den Suchergebnissen (auch der Filter-Chip „Shorts“), aus der Seitenleiste, von Kanalseiten (Reiter „Shorts“) und aus den Abos. Direkte Shorts-Links öffnen als normales Video.
- Beide Schalter sind anfangs aus und wirken sofort, ohne Neuladen.
- Popup zeigt unten, ob TubeShield auf dem offenen Tab aktiv ist – und wenn nicht, wo man in Safari den Zugriff auf youtube.com erlaubt. Geänderte Schalter gehen direkt an den offenen Tab.

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
