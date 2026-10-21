#!/bin/bash
# The deployment gate: nothing ships unless every suite passes.
#   npm test            (set CHROMIUM_PATH to use a specific Chromium for the browser suite)
cd "$(dirname "$0")/.."
fail=0
run() {
  echo "━━ $1"
  out=$($2 2>&1); code=$?
  echo "$out" | grep -E "✅|❌|checked|worst|every pick|rebuild changed|differs" | tail -${3:-8}
  [ $code -ne 0 ] && { fail=1; echo "$out" | grep "❌" | head -20; }
}
npx vite build --mode test --logLevel error || exit 1   # test mode: no project baked in, tests point it at the local stand-in
run "gear contract"        "node tests/verify.mjs"
run "programming quality"  "node tests/audit2.mjs"
run "rebuild/swap/hide"    "node tests/rebuildtest.mjs"
run "single session"       "node tests/quicktest.mjs"
run "history vs routine"   "node tests/historytest.mjs"
run "logged workouts"      "node tests/logparsetest.mjs"
run "owned bells"          "node tests/weightstest.mjs"
run "warm-up off"          "node tests/warmuptest.mjs"
run "weekly split"         "node tests/weektest.mjs"
run "your calendar"        "node tests/calendartest.mjs"
run "progress maths"       "node tests/progresstest.mjs"
run "schema + RLS"         "node tests/schematest.mjs"
run "data layer"           "node tests/repotest.mjs"
run "end to end"           "node tests/e2e.mjs" 3
run "security headers"     "node tests/csptest.mjs" 3
run "phone safe areas"     "node tests/safearea.mjs" 3
a=$(node tests/audit2.mjs)
for pat in "junk volume): 0 " "over 75 min: 0 " "isolation work: 0 " "CANNOT be loaded: 0"; do
  echo "$a" | grep -q "$pat" || { echo "❌ audit limit breached: $pat"; fail=1; }
done
[ $fail -eq 0 ] && echo -e "\n✅ ALL GATES GREEN" || { echo -e "\n❌ GATE FAILED"; exit 1; }
