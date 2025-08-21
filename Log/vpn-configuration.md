---

# Admin Panel Access Management Guide

## Overview

Access to the SocioBridge Admin Panel is protected by two layers of security:

1.  **WireGuard VPN:** All users must first connect to the company VPN. This creates a secure, encrypted tunnel to our server.
2.  **IP Whitelisting:** The server is configured to only accept connections from approved IP addresses. For VPN users, this is typically the server's own public IP, but can be expanded for office networks.

This guide explains how to manage access for new devices and IP addresses.

---

## 1. Managing WireGuard VPN Clients

All actions are performed by running a script on the server.

**Prerequisite:** You must be connected to the server via SSH.

### 1.1 How to Add a New Client (for a New Device)

Each new device (phone, laptop, etc.) requires its own unique VPN profile. **Do not reuse QR codes or configuration files.**

1.  **Navigate to the script's directory and run it:**
    ```bash
    cd /home/sociobridgegp/
    sudo ./wireguard-install.sh
    ```

2.  The script will detect that WireGuard is already installed and show a menu. Choose option **1**:
    ```
    Select an option:
      1) Add a new client
      2) Revoke an existing client
      3) Remove WireGuard
      4) Exit
    Select an option: 1
    ```

3.  **Enter a unique name for the new client.** This should be descriptive (e.g., `janes-macbook`, `david-pixel-phone`).
    ```
    Client name: janes-macbook
    ```

4.  The script will generate a new configuration. The easiest way to add it to a device is by using the **QR code** that is displayed in the terminal.

    *   On the new device, install the official WireGuard app.
    *   Use the app's "Scan from QR code" feature to add the new profile.

### 1.2 How to Remove (Revoke) a Client

If a device is lost, stolen, or an employee leaves, you must revoke their VPN access.

1.  **Navigate to the script's directory and run it:**
    ```bash
    cd /home/sociobridgegp/
    sudo ./wireguard-install.sh
    ```

2.  Choose option **2** from the menu:
    ```
    Select an option:
      1) Add a new client
      2) Revoke an existing client
      3) Remove WireGuard
      4) Exit
    Select an option: 2
    ```

3.  The script will list all existing clients. **Enter the number** corresponding to the client you wish to remove.
    ```
    Select the client to revoke:
    1) my-android-phone
    2) janes-macbook
    Select the client to revoke: 2
    ```

4.  Confirm the removal. The client's key will be removed from the server, and their access will be immediately revoked.

---

## 2. Managing Whitelisted IP Addresses

There are two places where IP addresses are whitelisted. You may need to edit one or both depending on the situation.

### 2.1 GCP Firewall (for Direct IP Access: `http://34.81.179.191:8080`)

This firewall rule controls direct access to the admin application on port 8080. **For our current VPN setup, this should only contain the server's own public IP.**

1.  Navigate to the [GCP Firewall Console](https://console.cloud.google.com/vpc/firewalls).
2.  Find and click on the rule named **`allow-admin-from-self-and-vpn`** (or similar) to edit it.
3.  Find the **Source IPv4 ranges** section.

*   **To Add an IP:** Click **ADD IPV4 RANGE** and enter the new IP address. For a single IP, use `/32` CIDR notation (e.g., `8.8.8.8/32`).
*   **To Remove an IP:** Click the **X** icon next to the IP address you wish to remove.

4.  Click **Save** at the bottom of the page. The change takes effect almost immediately.

### 2.2 Apache Configuration (for Domain Access: `https://admin.sociobridge.world`)

This configuration controls access to the admin panel via its domain name. **For our current VPN setup, this should also only contain the server's own public IP.**

1.  **Connect to the server via SSH.**

2.  **Open the configuration file** in a text editor:
    ```bash
    sudo nano /etc/apache2/sites-available/admin.sociobridge.world-le-ssl.conf
    ```

3.  **Find the `<Location />` block.** It will look like this:
    ```apache
    <Location />
        Require ip 34.81.179.191
    </Location>
    ```

*   **To Add an IP:** Add a new `Require ip ...` line below the existing one.
    ```apache
    <Location />
        Require ip 34.81.179.191
        Require ip 8.8.8.8
    </Location>
    ```
*   **To Remove an IP:** Delete the corresponding `Require ip ...` line.

4.  **Save and close the file** (`Ctrl+X`, `Y`, `Enter`).

5.  **You MUST test and restart Apache** for the changes to take effect.
    ```bash
    # Test the configuration for syntax errors
    sudo apache2ctl configtest

    # If it returns "Syntax OK", restart Apache
    sudo systemctl restart apache2
    ```

> **Important:** If the syntax test fails, do not restart Apache. Re-open the file and fix the error. Restarting with a broken configuration will take the site offline.