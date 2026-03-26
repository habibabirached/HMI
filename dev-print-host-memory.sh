#!/usr/bin/env bash
#
# Print host RAM/swap snapshot. Use this to see if Docker builds/runs correlate
# with memory pressure (freeze / OOM). Safe to run on Linux; on macOS `free` may
# be missing — we still print what we can.
#
# Usage (from repo root, or any cwd):
#   ./dev-print-host-memory.sh "my label"
#

LABEL="${1:-snapshot}"

echo ""
echo "========== HOST MEMORY [${LABEL}] @ $(date -u +"%Y-%m-%dT%H:%M:%SZ") (UTC) =========="

if command -v free >/dev/null 2>&1; then
  free -h
  echo "---"
  free -b | head -3
else
  echo "(free(1) not installed — common on macOS)"
fi

if [[ -r /proc/meminfo ]]; then
  echo "--- /proc/meminfo (first 8 lines) ---"
  head -8 /proc/meminfo
fi

# Recent OOM kills from kernel ring buffer (Linux; may need sudo on locked-down hosts)
if command -v dmesg >/dev/null 2>&1; then
  OOM_LINES="$(dmesg -T 2>/dev/null | grep -i -E 'oom|killed process|out of memory' | tail -5 || true)"
  if [[ -n "$OOM_LINES" ]]; then
    echo "--- recent OOM-related dmesg (last 5 hits) ---"
    echo "$OOM_LINES"
  fi
fi

echo "================================================================================"
echo ""
