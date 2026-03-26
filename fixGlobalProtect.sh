#!/bin/bash
# fixGlobalProtect.sh - Fixes GlobalProtect VPN routing issues on macOS
# Run with: sudo ./fixGlobalProtect.sh

set -e

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root. Use: sudo $0"
   exit 1
fi

echo "=== GlobalProtect Routing Fix ==="

# Step 1: Capture default gateway BEFORE we mess with routes (in case we need to restore it)
DEFAULT_GW=""
if route -n get default &>/dev/null; then
    DEFAULT_GW=$(route -n get default 2>/dev/null | grep 'gateway:' | awk '{print $2}')
fi

# Fallback: get gateway from primary interface (Wi-Fi or Ethernet)
if [[ -z "$DEFAULT_GW" ]]; then
    for iface in Wi-Fi Ethernet; do
        if networksetup -getinfo "$iface" &>/dev/null; then
            DEFAULT_GW=$(networksetup -getinfo "$iface" 2>/dev/null | grep 'Router:' | head -1 | awk '{print $2}')
            [[ -n "$DEFAULT_GW" ]] && break
        fi
    done
fi

# Last resort: common default gateway for 192.168.0.x
if [[ -z "$DEFAULT_GW" ]]; then
    DEFAULT_GW="192.168.0.1"
    echo "Could not detect gateway, using fallback: $DEFAULT_GW"
else
    echo "Detected gateway: $DEFAULT_GW"
fi

# Step 2: Remove orphaned IPv6 default routes from utun interfaces (left behind by GlobalProtect)
echo "Removing orphaned utun default routes..."
for i in 0 1 2 3 4 5 6 7 8 9; do
    if ifconfig utun$i &>/dev/null; then
        route -n delete -inet6 default -ifscope utun$i 2>/dev/null && echo "  Removed default from utun$i" || true
    fi
done

# Step 3: Flush routing cache and DNS
echo "Flushing routing cache..."
route -n flush 2>/dev/null || true
dscacheutil -flushcache 2>/dev/null || true
killall -HUP mDNSResponder 2>/dev/null || true

# Step 4: Ensure IPv4 default route exists
if ! route -n get default &>/dev/null 2>&1; then
    echo "No default route found. Adding default via $DEFAULT_GW..."
    route -n add default "$DEFAULT_GW"
    echo "  Default route restored."
else
    echo "Default route already exists."
fi

# Step 5: Verify connectivity
echo ""
echo "Verifying connectivity..."
if ping -c 2 -t 3 google.com &>/dev/null; then
    echo "SUCCESS: Network connectivity restored."
else
    echo "WARNING: Ping failed. You may need to:"
    echo "  1. Quit GlobalProtect (right-click menu bar icon -> Quit)"
    echo "  2. Reconnect to your VPN or restart GlobalProtect"
    echo "  3. Re-run this script"
fi

echo ""
echo "Done. Try reconnecting to GlobalProtect if you need VPN access."
