```markdown
You have asked an excellent and critically important question. Your intuition is correct: exposing an application on a non-standard port like `:8080` and leaving it without a login system are significant security risks.

The complete, professional solution involves two main parts that work together:

1.  **Use a Reverse Proxy:** This will "hide" the port number and allow you to use a clean, professional subdomain like `admin.sociobridge.world`.
2.  **Implement a Login System:** This is non-negotiable. It ensures that only authorized users can access the admin panel, regardless of the URL.

Let's tackle both.

---

### Part 1: Hiding the Port with a Reverse Proxy

A reverse proxy is a server (usually your main web server, Nginx or Apache) that sits in front of your admin application. It takes public requests for a nice URL (like `admin.sociobridge.world`) and forwards them internally to your application running on `localhost:8080`. The user never sees the port number.

First, you need to create a DNS "A" record for a subdomain. Go to your domain registrar and create an `A` record for `admin` that points to the same IP address as `sociobridge.world`.

Next, you need to configure your web server. Since you're using Google Cloud with WordPress, you are likely using either **Nginx** or **Apache**. Here are the instructions for both.

#### Option A: If you are using Nginx

1.  **Create a new Nginx configuration file:**

    ```bash
    sudo nano /etc/nginx/sites-available/admin.sociobridge.world
    ```

2.  **Paste the following configuration into the file.** This is a "server block" that tells Nginx how to handle requests for your new subdomain.

    ```nginx
    server {
        listen 80;
        server_name admin.sociobridge.world;

        # Optional: Add access and error logs
        access_log /var/log/nginx/admin.access.log;
        error_log /var/log/nginx/admin.error.log;

        location / {
            # This is the magic part.
            # It forwards all requests to your application running on port 8080.
            proxy_pass http://127.0.0.1:8080;
            
            # These headers are important for the backend application to know
            # about the original request.
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```

3.  **Enable the new site and test the configuration:**

    ```bash
    # Create a symbolic link to enable the site
    sudo ln -s /etc/nginx/sites-available/admin.sociobridge.world /etc/nginx/sites-enabled/

    # Test your Nginx configuration for syntax errors
    sudo nginx -t

    # If the test is successful, reload Nginx to apply the changes
    sudo systemctl reload nginx
    ```

#### Option B: If you are using Apache

1.  **Enable the necessary proxy modules:**

    ```bash
    sudo a2enmod proxy
    sudo a2enmod proxy_http
    sudo systemctl restart apache2
    ```
2.  Run Certbot for your new subdomain. This will automatically get a certificate and create a new HTTPS configuration file for you.
    sudo certbot --apache -d admin.sociobridge.world
    
3.  **Create a new Apache configuration file:**

    ```bash
    sudo nano /etc/apache2/sites-available/admin.sociobridge.world-le-ssl.conf
    ```

4.  **Paste the following configuration into the file.** This is a "VirtualHost" block.

    ```apache
    <IfModule mod_ssl.c>
    <VirtualHost *:443>
    ServerName admin.sociobridge.world

    # --- START OF REQUIRED CHANGES ---

    # Enable the SSL Engine for the proxy connection
    SSLProxyEngine on

    # These two lines prevent certificate validation errors for the internal connection
    SSLProxyCheckPeerName off
    SSLProxyCheckPeerExpire off

    ProxyPreserveHost On
    
    # Change http to https for the backend connection
    ProxyPass / https://127.0.0.1:8080/
    ProxyPassReverse / https://127.0.0.1:8080/

    # --- END OF REQUIRED CHANGES ---

    # The rest of the file is the standard Certbot SSL configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/admin.sociobridge.world/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/admin.sociobridge.world/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    # Log files
    ErrorLog ${APACHE_LOG_DIR}/admin-error.log
    CustomLog ${APACHE_LOG_DIR}/admin-access.log combined
    </VirtualHost>
    </IfModule>
    ```

5.  **Enable the new site and test the configuration:**

    ```bash
    # Enable the new site configuration
    sudo a2ensite admin.sociobridge.world.conf

    # Test your Apache configuration for syntax errors
    sudo apache2ctl configtest

    # If the test is successful, reload Apache to apply the changes
    sudo systemctl reload apache2
    ```

After completing these steps, you should be able to access your admin panel by going to `http://admin.sociobridge.world` in your browser, with no port number!

---

### Part 2: Creating a Simple and Secure Login System

This is the most critical step. We will create a basic PHP session-based login system.

#### Step 1: Create a `login.php` Page

This will be the entry point to your admin panel. Create `/var/www/admin/login.php`.

```php
<?php
// /var/www/admin/login.php
session_start();

// If the user is already logged in, redirect them to the index page
if (isset($_SESSION['loggedin']) && $_SESSION['loggedin'] === true) {
    header('Location: index.php');
    exit;
}

$error_message = '';

// --- IMPORTANT: Replace with your actual credentials ---
// In a real application, you would fetch this from a database.
// The password hash is generated from the script in the next step.
$valid_username = 'admin';
$valid_password_hash = '$2y$10$YOUR_GENERATED_PASSWORD_HASH_HERE'; // <-- REPLACE THIS

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if ($username === $valid_username && password_verify($password, $valid_password_hash)) {
        // Password is correct, so start a new session
        session_regenerate_id();
        $_SESSION['loggedin'] = true;
        $_SESSION['username'] = $username;
        header('Location: index.php');
        exit;
    } else {
        $error_message = 'Invalid username or password.';
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <title>Admin Login</title>
    <style>/* Add some basic styling for the login form */</style>
</head>
<body>
    <div class="login-container">
        <h2>Admin Panel Login</h2>
        <form action="login.php" method="post">
            <input type="text" name="username" placeholder="Username" required>
            <input type="password" name="password" placeholder="Password" required>
            <button type="submit">Login</button>
        </form>
        <?php if ($error_message): ?>
            <p class="error"><?php echo $error_message; ?></p>
        <?php endif; ?>
    </div>
</body>
</html>```

#### Step 2: Securely Generate Your Password Hash

**NEVER store passwords as plain text.** We use PHP's `password_hash()` function. Create a temporary file named `create_hash.php` in `/var/www/admin/` to generate your hash.

```php
<?php
// /var/www/admin/create_hash.php
$password = 'YourSecurePassword123!'; // <-- Choose a strong password
$hash = password_hash($password, PASSWORD_DEFAULT);
echo "Your password hash is: " . $hash;
?>
```

Access this file once in your browser (`http://admin.sociobridge.world/create_hash.php`). Copy the long hash string it generates, paste it into the `$valid_password_hash` variable in `login.php`, and then **delete the `create_hash.php` file immediately.**

#### Step 3: Protect All Your Other Admin Pages

Now, you need to add a check at the very top of **every single admin page** (`index.php`, `sync.php`, `view_database.php`, etc.) to ensure the user is logged in.

The best way is to create a reusable file. Create `/var/www/admin/auth_check.php`:

```php
<?php
// /var/www/admin/auth_check.php
session_start();

// If the user is not logged in, redirect them to the login page
if (!isset($_SESSION['loggedin']) || $_SESSION['loggedin'] !== true) {
    header('Location: login.php');
    exit;
}
?>
```

Now, at the **very top** of `index.php`, `sync.php`, and `view_database.php`, add this single line:

```php
<?php require_once 'auth_check.php'; ?>
<!-- The rest of your page's HTML and PHP code follows -->
```

#### Step 4: Create a `logout.php` Page

Create `/var/www/admin/logout.php` to allow users to log out.

```php
<?php
// /var/www/admin/logout.php
session_start();
session_unset();
session_destroy();
header('Location: login.php');
exit;
?>
```

Add a link to this file on your main admin pages, for example: `<a href="logout.php">Logout</a>`.

### Final Step: Harden Your Firewall

Now that you have the reverse proxy, the *only* way to access your admin panel should be through the proxy. You can now block public access to port 8080.

```bash
# Allow access to port 8080 ONLY from the server itself (localhost)
sudo ufw allow from 127.0.0.1 to any port 8080

# If you previously had a rule like "ufw allow 8080", DELETE it.
# Find the rule number first
sudo ufw status numbered
# Then delete it (e.g., if it's rule 5)
sudo ufw delete 5
```

This final step ensures that nobody can bypass your secure `admin.sociobridge.world` URL and access your application directly via the port number.

```