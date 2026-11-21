#!/bin/bash
# TubeShield bauen, signieren und nach /Applications installieren.
#
#   ./scripts/build.sh                 # bauen + installieren
#   ./scripts/build.sh --no-install    # nur bauen
#   ./scripts/build.sh --release       # Download-Version: ad-hoc signiert,
#                                      # nicht installiert, als ZIP in dist/
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
RELEASE=0
for arg in "$@"; do
  case "$arg" in
    --no-install) INSTALL=0 ;;
    --release) INSTALL=0; RELEASE=1 ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 1 ;;
  esac
done
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$ROOT/extension/manifest.json")"

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode fehlt oder ist nicht aktiv. Installieren und dann:" >&2
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

TEAM="${TUBESHIELD_TEAM:-}"
if [[ $RELEASE -eq 0 && -z "$TEAM" && -f "$ROOT/.team" ]]; then
  TEAM="$(tr -d '[:space:]' < "$ROOT/.team")"
fi

echo "==> Erweiterungsdateien ins Xcode-Projekt übernehmen"
mkdir -p "$RESOURCES"
rsync -a --delete "$ROOT/extension/" "$RESOURCES/"

echo "==> Bauen"
SIGN_ARGS=()
EXTRA_ARGS=()
if [[ $RELEASE -eq 1 ]]; then
  TEAM=""
  # Download-Version: Apple-Chip und Intel, ab macOS 13
  EXTRA_ARGS=(ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO MACOSX_DEPLOYMENT_TARGET=13.0)
fi
if [[ -n "$TEAM" ]]; then
  echo "    Signiere mit Team $TEAM"
  SIGN_ARGS=(DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates)
else
  echo "    Kein Team gesetzt -> ad-hoc-Signatur"
  SIGN_ARGS=(CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM=)
fi
rm -rf "$BUILD_DIR"
xcodebuild -project "$PROJECT_DIR/TubeShield.xcodeproj" -scheme TubeShield \
  -configuration Release -derivedDataPath "$BUILD_DIR" "${SIGN_ARGS[@]}" \
  ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"} MARKETING_VERSION="$VERSION" build \
  | grep -E "error:|BUILD (SUCCEEDED|FAILED)" || true
[[ -d "$APP" ]] || { echo "Build fehlgeschlagen." >&2; exit 1; }

echo "==> Prüfen"
codesign --verify --deep --strict "$APP"
diff -r "$ROOT/extension" "$APP/Contents/PlugIns/TubeShield Extension.appex/Contents/Resources" >/dev/null \
  || { echo "App enthält nicht die aktuellen Erweiterungsdateien." >&2; exit 1; }
echo "    Signatur gültig, Dateien aktuell."

if [[ $RELEASE -eq 1 ]]; then
  echo "==> Download-Version packen"
  mkdir -p "$ROOT/dist"
  ZIP="$ROOT/dist/TubeShield-$VERSION.zip"
  rm -f "$ZIP"
  ditto -c -k --keepParent "$APP" "$ZIP"
  echo "    $ZIP"
fi

if [[ $INSTALL -eq 1 ]]; then
  echo "==> Installieren nach /Applications"
  pkill -x TubeShield 2>/dev/null || true
  sleep 1
  rm -rf /Applications/TubeShield.app
  cp -R "$APP" /Applications/
  open /Applications/TubeShield.app
  echo "    Fertig. In Safari einmal die Seite neu laden."
fi

# Die Kopie im Build-Ordner abmelden und löschen. Sonst sieht Safari zwei
# TubeShield-Erweiterungen mit derselben ID und lädt womöglich die falsche.
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
pluginkit -r "$APP/Contents/PlugIns/TubeShield Extension.appex" 2>/dev/null || true
"$LSREGISTER" -u "$APP" 2>/dev/null || true
rm -rf "$BUILD_DIR/Build/Products"
