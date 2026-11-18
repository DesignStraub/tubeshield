#!/bin/bash
# TubeShield bauen, signieren und nach /Applications installieren.
#
#   ./scripts/build.sh                 # bauen + installieren
#   ./scripts/build.sh --no-install    # nur bauen
#
# Signierung: Deine Apple-Team-ID wird aus der Umgebungsvariable
# TUBESHIELD_TEAM oder aus der (nicht eingecheckten) Datei .team gelesen.
# Ohne Team wird nur ad-hoc signiert – dann muss in Safari
# "Unsignierte Erweiterungen erlauben" aktiv sein (wird bei jedem
# Safari-Neustart zurückgesetzt).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="$ROOT/xcode/TubeShield"
RESOURCES="$PROJECT_DIR/TubeShield Extension/Resources"
BUILD_DIR="$PROJECT_DIR/build"
APP="$BUILD_DIR/Build/Products/Release/TubeShield.app"
INSTALL=1
[[ "${1:-}" == "--no-install" ]] && INSTALL=0

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode fehlt oder ist nicht aktiv. Installieren und dann:" >&2
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

TEAM="${TUBESHIELD_TEAM:-}"
if [[ -z "$TEAM" && -f "$ROOT/.team" ]]; then
  TEAM="$(tr -d '[:space:]' < "$ROOT/.team")"
fi

echo "==> Erweiterungsdateien ins Xcode-Projekt übernehmen"
mkdir -p "$RESOURCES"
rsync -a --delete "$ROOT/extension/" "$RESOURCES/"

echo "==> Bauen"
SIGN_ARGS=()
if [[ -n "$TEAM" ]]; then
  echo "    Signiere mit Team $TEAM"
  SIGN_ARGS=(DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates)
else
  echo "    Kein Team gesetzt -> ad-hoc-Signatur"
  SIGN_ARGS=(CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=)
fi
rm -rf "$BUILD_DIR"
xcodebuild -project "$PROJECT_DIR/TubeShield.xcodeproj" -scheme TubeShield \
  -configuration Release -derivedDataPath "$BUILD_DIR" "${SIGN_ARGS[@]}" build \
  | grep -E "error:|BUILD (SUCCEEDED|FAILED)" || true
[[ -d "$APP" ]] || { echo "Build fehlgeschlagen." >&2; exit 1; }

echo "==> Prüfen"
codesign --verify --deep --strict "$APP"
diff -r "$ROOT/extension" "$APP/Contents/PlugIns/TubeShield Extension.appex/Contents/Resources" >/dev/null \
  || { echo "App enthält nicht die aktuellen Erweiterungsdateien." >&2; exit 1; }
echo "    Signatur gültig, Dateien aktuell."

if [[ $INSTALL -eq 1 ]]; then
  echo "==> Installieren nach /Applications"
  pkill -x TubeShield 2>/dev/null || true
  sleep 1
  rm -rf /Applications/TubeShield.app
  cp -R "$APP" /Applications/
  open /Applications/TubeShield.app
  echo "    Fertig. In Safari einmal die Seite neu laden."
fi
