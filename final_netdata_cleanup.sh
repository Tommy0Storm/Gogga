#!/bin/bash

# Final cleanup script for netdata removal
# Run this with sudo: sudo bash final_netdata_cleanup.sh

echo "Fixing dpkg errors..."
dpkg --configure -a

echo "Forcing removal of problematic netdata packages..."
apt remove --purge -y netdata-dashboard netdata-repo-edge

echo "Removing any remaining netdata files..."
rm -rf /var/lib/netdata /var/cache/netdata /etc/netdata /usr/libexec/netdata /usr/sbin/netdata
rm -rf /var/log/netdata /run/netdata

echo "Removing netdata user and group if they exist..."
if id netdata &>/dev/null; then
    userdel netdata
fi
if getent group netdata &>/dev/null; then
    groupdel netdata
fi

echo "Cleaning up apt cache and fixing broken packages..."
apt autoremove -y
apt --fix-broken install -y

echo "Final cleanup complete!"
echo "You may want to reboot to ensure all netdata processes are gone."