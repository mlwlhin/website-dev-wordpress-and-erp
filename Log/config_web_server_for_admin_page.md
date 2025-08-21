Part 1: Configure the Web Server to Listen on a New Port
You need to tell your web server to accept incoming connections on an additional port besides the standard ones (80 and 443).

For Apache:
Connect to your VM: Use SSH to log in to your VM instance.

Edit the ports configuration file: Open the ports.conf file, which is typically located at /etc/apache2/ports.conf. You can use the command sudo nano /etc/apache2/ports.conf.

Add the new port: At the end of the file, add a Listen directive for your chosen port. For this example, let's use port 8080 by adding Listen 8080. The file will look similar to this:

# The default configuration
Listen 80
<IfModule ssl_module>
    Listen 443
</IfModule>

# Add a new port for your admin site
Listen 8080

Save the file and exit the editor.

Part 2: Host Your Admin Website on that Specific Port
Now, you need to create a separate configuration for your admin site that tells the web server what content to serve when a request comes in on the new port.

For Apache:
Create the directory for your admin site: Use the command sudo mkdir -p /var/www/admin.

Create a sample index file: Create a sample index.html file in the new directory for testing purposes by running sudo sh -c 'echo "<h1>Admin Page</h1>" > /var/www/admin/index.html'.

Create a new virtual host configuration file: A good location for this file is /etc/apache2/sites-available/admin.conf. Use the command sudo nano /etc/apache2/sites-available/admin.conf.

Add the virtual host block: Add the following configuration, ensuring the DocumentRoot points to your new directory:

<VirtualHost *:8080>
    ServerName youWebName.com
    DocumentRoot /var/www/admin

    # SSL/TLS Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/youWebName.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/youWebName.com/privkey.pem

    # Log files
    ErrorLog ${APACHE_LOG_DIR}/admin_error.log
    CustomLog ${APACHE_LOG_DIR}/admin_access.log combined
</VirtualHost>

Enable the new site and restart Apache: Enable the site with sudo a2ensite admin.conf and restart Apache with sudo systemctl restart apache2.

Part 3: Create Firewall Rules
This part outlines how to create firewall rules to manage traffic to your new port.

Go to the Google Cloud Console: Open your web browser and navigate to the Google Cloud Console.

Navigate to Firewall Rules: In the navigation menu, go to "VPC network" > "Firewall". This page lists existing firewall rules.

Click "Create Firewall Rule": Click the "Create firewall rule" button at the top of the page.

Fill in the Rule Details:

Name: Give the rule a descriptive name, such as allow-admin-port-8080.

Network: Select the VPC network your VM instance is connected to, which is typically the default network.

Priority: The default value (e.g., 1000) is fine.

Direction of traffic: Select Ingress to apply the rule to traffic entering your VM.

Action on match: Select Allow.

Target: The simplest option is "All instances in the network". A more precise method is to use "Specified target tags" and enter your VM's network tag.

Configure the Source Filter (CRITICAL SECURITY STEP):

Source filter: Choose IPv4 ranges.

Source IPv4 ranges: This is where you specify who can access the port. For secure access, enter the public IP address of your local PC and your colleagues' PCs. You can find your public IP by searching "what is my ip" on Google. Enter the IP addresses in CIDR notation, e.g., 203.0.113.1/32. You can add multiple IPs on new lines.

Specify the Protocols and Ports:

Protocols and ports: Select Specified protocols and ports.

Check the box next to tcp and enter 8080 in the field.

Create the Rule: Review the settings to ensure they are correct and click the Create button.