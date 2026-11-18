# TubeShield

**Ein schlanker, privater Adblocker für Safari auf dem Mac – mit YouTube-Werbeblocker und Schutz vor YouTubes automatischer Pause („Video pausiert. Weiterschauen?“).**

> *English summary:* TubeShield is a small, open-source Safari Web Extension for macOS. It blocks ads and trackers on all websites (~93,000 network rules generated from EasyList, EasyPrivacy and EasyList Germany), skips/hides YouTube video ads, hides YouTube Premium upsell dialogs and automatically dismisses YouTube's "Video paused. Continue watching?" prompt. It collects no data at all. Build instructions below (German).

---

## Inhalt

- [Funktionen](#funktionen)
- [Datenschutz](#datenschutz)
- [Installation](#installation)
- [Testen, ob es wirkt](#testen-ob-es-wirkt)
- [Filterlisten aktualisieren](#filterlisten-aktualisieren)
- [Wie es funktioniert](#wie-es-funktioniert)
- [Projektstruktur](#projektstruktur)
- [Grenzen](#grenzen)
- [Lizenz & Credits](#lizenz--credits)

---

## Funktionen

| Bereich | Was passiert |
|---|---|
| **Alle Websites** | Rund 93.000 Netzwerk-Regeln blockieren Werbe- und Tracking-Server, bevor überhaupt etwas geladen wird. |
| **YouTube: Video-Werbung** | „Überspringen“ wird automatisch geklickt. Sonst wird der Spot stumm geschaltet und übersprungen bzw. mit 16-facher Geschwindigkeit durchgespielt. Bild, Steuerleiste und die gelben Werbe-Leisten sind währenddessen unsichtbar. Ton und Tempo werden danach wiederhergestellt. |
| **YouTube: Banner & Feed** | Werbekacheln auf der Startseite, neben dem Video, in Shorts und in der Suche werden ausgeblendet. |
| **YouTube: Premium-Werbung** | Premium-Werbedialoge und -leisten werden ausgeblendet und über ihren eigenen „Nein danke“-Knopf geschlossen – nie über den Kaufen-Knopf. |
| **YouTube: Auto-Pause** | Der Dialog „Video pausiert. Weiterschauen?“ (und „Bist du noch da?“ bei YouTube Music) wird automatisch bestätigt und das Video läuft weiter. |
| **Popup** | Zwei Schalter: *Werbung blockieren* und *Auto-Pause verhindern*. |

**Sicherheitsnetz beim Auto-Pause-Block:** TubeShield greift nur ein, wenn das Video *ohne* deinen Klick oder Tastendruck angehalten wurde. Andere Bestätigungsdialoge (z. B. „Aus Playlist entfernen?“) werden nie automatisch bestätigt.

## Datenschutz

TubeShield **sammelt, speichert und sendet keine Daten**. Es gibt keinen Server, keine Telemetrie, keine Konten.

- Das Blockieren übernimmt Safari selbst anhand fester Regeln (`declarativeNetRequest`). Die Erweiterung sieht dabei nicht, welche Seiten du besuchst.
- Das YouTube-Skript läuft ausschließlich auf `youtube.com` und verändert nur die Seite in deinem Browser.
- Gespeichert werden nur die zwei Schalter aus dem Popup – lokal in Safari.
- Einzige Netzwerkverbindung des ganzen Projekts: Das Hilfsskript `tools/update-filters.py` lädt *beim Entwickeln* die öffentlichen Filterlisten von easylist.to. Die installierte Erweiterung selbst verbindet sich nirgendwohin.

## Installation

### Voraussetzungen

- Mac mit aktuellem macOS und Safari
- **Xcode** (kostenlos im App Store)
- Eine **Apple-ID** (kostenlos reicht) – nötig, damit Safari die Erweiterung dauerhaft behält

### Einmalig einrichten

1. **Xcode installieren**, einmal öffnen und die Zusatzkomponenten installieren lassen. Dann im Terminal:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. **Apple-ID in Xcode anmelden:** Xcode → Einstellungen → Accounts → **+** → Apple ID.
3. **Repository klonen:**
   ```bash
   git clone https://github.com/DesignStraub/tubeshield.git
   cd tubeshield
   ```
4. **Team-ID eintragen.** Die einfachste Variante: Projekt in Xcode öffnen (`xcode/TubeShield/TubeShield.xcodeproj`), bei beiden Targets unter *Signing & Capabilities* dein „Personal Team“ wählen, Xcode schließen und die ID ablesen mit
   ```bash
   grep -m1 DEVELOPMENT_TEAM xcode/TubeShield/TubeShield.xcodeproj/project.xcproj
   ```
   Die 10-stellige ID dann in eine Datei `.team` im Projektordner schreiben (sie wird nicht mit hochgeladen):
   ```bash
   echo "DEINE_TEAM_ID" > .team
   ```

### Bauen & installieren

```bash
./scripts/build.sh
```

Das Skript übernimmt die Dateien aus `extension/` ins Xcode-Projekt, baut und signiert die App, prüft Signatur und Inhalt und installiert sie nach `/Applications/TubeShield.app`.

### In Safari aktivieren

1. Safari → Einstellungen → **Erweiterungen** → Haken bei **TubeShield**.
2. Bei TubeShield den Zugriff auf **youtube.com** auf „Immer erlauben“ stellen.
3. Offene Seiten neu laden.

Die App muss **nicht** laufen und braucht **keinen Autostart** – sie muss nur in „Programme“ liegen. Safari lädt die Erweiterung selbst.

> **Ohne Apple-ID / Team** baut das Skript eine ad-hoc-signierte Version. Die funktioniert nur mit Safari → Einstellungen → Entwickler → „Unsignierte Erweiterungen erlauben“, und das schaltet Safari bei jedem Neustart wieder aus.

> **Laufzeit der Signatur:** Mit einem kostenlosen Konto ist das Entwicklerzertifikat ein Jahr gültig. Danach einfach `./scripts/build.sh` erneut ausführen.

## Testen, ob es wirkt

- **Allgemeiner Adblock:** Eine öffentliche Adblock-Testseite öffnen, z. B. <https://d3ward.github.io/toolz/adblock>. Sie zeigt an, wie viele Werbe- und Tracking-Server blockiert werden.
- **YouTube:** Ein Musikvideo öffnen – Werbung sollte nicht zu sehen sein, das Video startet nach höchstens einem kurzen schwarzen Moment.

## Filterlisten aktualisieren

Die Regeln in `extension/rules/filters.json` werden aus öffentlichen Filterlisten erzeugt. Zum Aktualisieren (z. B. alle paar Wochen):

```bash
python3 tools/update-filters.py
./scripts/build.sh
```

Eigene Regeln kommen in `tools/custom-rules.txt` (Adblock-Plus-Syntax, z. B. `||werbung.example^`).

## Wie es funktioniert

```
extension/
├── manifest.json          Safari Web Extension (Manifest V3)
├── rules/custom.json      eigene Regeln (aus tools/custom-rules.txt)
├── rules/filters.json     ~93.000 Regeln aus EasyList & Co.
├── content/youtube.js     YouTube: Werbung, Auto-Pause, Premium-Dialoge
├── content/youtube.css    YouTube: ausgeblendete Werbe-Elemente
└── popup/                 Popup mit den zwei Schaltern
```

**Netzwerk-Blockieren** – Safari wertet die Regeln selbst aus (`declarativeNetRequest`). Übernommen werden nur einfache, robuste Domain-Regeln (`||domain^`, optional mit `$third-party` oder Ressourcentypen). Komplexe Regeln, Pfad-Muster und `$domain=`-Regeln werden bewusst übersprungen, weil sie am ehesten Seiten kaputt machen. Hauptseiten werden nie blockiert, nur eingebettete Inhalte. Die Regeln sind auf zwei Regelsätze verteilt: Sollte Safari die große Liste einmal ablehnen, bleibt der Grundschutz aus `custom.json` aktiv.

**YouTube-Werbung** – Das Skript prüft alle 250 ms, ob der Player die Klasse `ad-showing` trägt. Dann:
1. Skip-Knöpfe klicken,
2. stumm schalten und auf 16-fache Geschwindigkeit stellen,
3. bei separat geladenen Spots (≤ 3 Minuten) ans Ende springen. Bei Werbung, die YouTube direkt in den Videostream einbettet, wird **nicht** gesprungen – sonst würde das eigentliche Video übersprungen.

Per CSS sind Bild und Bedienelemente während der Werbung sofort unsichtbar, ohne Überblend-Animation.

**Auto-Pause** – Das Skript merkt sich, wann zuletzt eine *echte* Eingabe (Klick, Taste, Touch) kam. Wird das Video ohne Eingabe pausiert und erscheint dann YouTubes Bestätigungsdialog, klickt es „Ja“ und setzt die Wiedergabe fort.

## Projektstruktur

```
tubeshield/
├── extension/        Quellcode der Erweiterung (hier wird entwickelt)
├── xcode/            Xcode-Projekt: Mac-App, die die Erweiterung enthält
├── tools/            Filterlisten-Konverter und eigene Regeln
├── scripts/build.sh  Bauen, signieren, installieren
├── CHANGELOG.md
└── LICENSE           GPL-3.0
```

Änderungen immer in `extension/` machen – `scripts/build.sh` kopiert sie ins Xcode-Projekt.

## Grenzen

- **YouTube ändert seine Seite regelmäßig.** Hört etwas auf zu funktionieren, sind meist nur Selektoren in `content/youtube.js` / `content/youtube.css` anzupassen.
- **In den Stream eingebettete Werbung** lässt sich nicht entfernen, nur stumm und schnell durchspielen.
- **Auf anderen Websites** werden Werbe-Server blockiert, leere Werbeflächen aber nicht ausgeblendet (keine allgemeinen Element-Regeln – bewusst, um Seiten nicht zu beschädigen).
- Nur **Safari auf macOS** (iOS wäre mit dem Xcode-Projekt möglich, ist aber nicht eingerichtet).

## Lizenz & Credits

TubeShield steht unter der **GNU General Public License v3.0** – siehe [LICENSE](LICENSE).

Die Regeln in `extension/rules/filters.json` werden aus diesen Listen erzeugt:

- [EasyList](https://easylist.to/), [EasyPrivacy](https://easylist.to/) und [EasyList Germany](https://easylist.to/) – © The EasyList authors, lizenziert unter GPLv3 bzw. CC BY-SA 3.0.

Danke an alle, die diese Listen pflegen.
