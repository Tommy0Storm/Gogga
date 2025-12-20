#!/bin/bash

# Script to fix grub configuration and remove netdata
# Run this with sudo: sudo bash fix_grub_and_remove_netdata.sh

echo "Fixing grub configuration..."
# Remove the problematic line from grub config
sed -i '/^usbcore.autosuspend=-1$/d' /etc/default/grub

echo "Updating grub..."
update-grub

echo "Fixing the partial removal of linux-image package..."
dpkg --configure -a

echo "Continuing with netdata removal..."
echo "Stopping netdata service..."
systemctl stop netdata

echo "Disabling netdata from startup..."
systemctl disable netdata

echo "Removing netdata packages..."
apt remove -y netdata netdata-dashboard netdata-plugin-apps netdata-plugin-chartsd \
    netdata-plugin-debugfs netdata-plugin-ebpf netdata-plugin-go \
    netdata-plugin-network-viewer netdata-plugin-nfacct netdata-plugin-otel \
    netdata-plugin-perf netdata-plugin-pythond netdata-plugin-slabinfo \
    netdata-plugin-systemd-journal netdata-plugin-systemd-units \
    netdata-repo-edge netdata-user

echo "Removing netdata configuration and data..."
rm -rf /var/lib/netdata /var/cache/netdata /etc/netdata

echo "Cleaning up dependencies..."
apt autoremove -y

echo "All done! Grub is fixed and netdata has been removed."