#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
: "${OPENCODE_WEB_DIR:?OPENCODE_WEB_DIR must be set by the worker}"
PORT="${PORT:-3000}"
OUTPUT_DIR="$PROJECT_DIR/dist"

if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    /usr/bin/time -p npm ci
  else
    /usr/bin/time -p npm install
  fi
  if /usr/bin/time -p node -e "const p=require('./package.json'); process.exit(p.scripts?.build ? 0 : 1)"; then
    /usr/bin/time -p npm run build
  elif [[ -d "$PROJECT_DIR/public" ]]; then
    /usr/bin/time -p mkdir -p "$OUTPUT_DIR"
    /usr/bin/time -p cp -a "$PROJECT_DIR/public/." "$OUTPUT_DIR/"
  else
    echo 'No build script or static public directory found.' >&2
    exit 1
  fi
else
  /usr/bin/time -p mkdir -p "$OUTPUT_DIR"
  /usr/bin/time -p cp -a "$PROJECT_DIR/public/." "$OUTPUT_DIR/"
fi

/usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"
PROJECT_DIR="$PROJECT_DIR" OUTPUT_DIR="$OUTPUT_DIR" /usr/bin/time -p node -e 'const fs=require("node:fs"); const p=process.env; fs.writeFileSync(`${p.OPENCODE_WEB_DIR}/deployment-output.json`, JSON.stringify({project:p.PROJECT_DIR,directory:p.OUTPUT_DIR}));'
echo "Serving $OUTPUT_DIR on port $PORT"
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$OUTPUT_DIR"
