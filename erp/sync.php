<?php
// /var/www/admin/sync.php

// 1. Include the database connection
require_once './db_connect.php';

// 2. Initialize variables to hold the script's output and any errors
$script_output = "";
$script_error = "";

// 3. Check if the form has been submitted (i.e., the button was clicked)
if ($_SERVER["REQUEST_METHOD"] == "POST" && isset($_POST['run_sync'])) {
    
    // --- IMPORTANT: Set the ABSOLUTE path to your shell script ---
    // Replace this with the actual, full path to your script.
    $script_path = '/var/www/admin/sync_script.sh'; // <--- CHANGE THIS PATH

    // 4. Security Check: Ensure the file exists and is executable
    if (is_executable($script_path)) {
        
        // 5. Execute the script
        // The `shell_exec()` function runs the command and returns the output.
        // `2>&1` is crucial: it redirects any errors from the script into the main output,
        // so you can see them on the web page.
        $output = shell_exec($script_path . ' 2>&1');
        
        // 6. Prepare the output for safe display in HTML
        $script_output = "Script execution finished.\n\nOutput:\n" . htmlspecialchars($output);

    } else {
        // If the script can't be run, create a helpful error message
        $script_error = "Error: The script at '" . htmlspecialchars($script_path) . "' either does not exist or is not executable by the web server. Please check permissions.";
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Manual Database Sync</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; margin: 2em; background-color: #f0f2f5; color: #333; }
        .container { max-width: 800px; margin: 0 auto; background-color: #fff; padding: 2em; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; }
        p { line-height: 1.6; }
        button { background-color: #163791ff; color: white; border: none; padding: 12px 25px; font-size: 16px; border-radius: 5px; cursor: pointer; transition: background-color 0.3s; }
        button:hover { background-color: #041d63ff; }
        .output-box { background-color: #2c3e50; color: #ecf0f1; border: 1px solid #34495e; padding: 1em; border-radius: 5px; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace; margin-top: 1.5em; max-height: 400px; overflow-y: auto; }
        .error-box { color: #e74c3c; font-weight: bold; background-color: #fbeaea; border: 1px solid #e74c3c; padding: 1em; border-radius: 5px; margin-top: 1.5em; }
        .home-button {
            display: inline-block;
            margin-bottom: 1.5em;
            padding: 8px 15px;
            background-color: #7f8c8d;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s;
        }
        .home-button:hover {
            background-color: #6c7a7b;
        }
    </style>
</head>
<body>

    <div class="container">

        <a href="./index.php" class="home-button">&larr; Return to Home</a>
        
        <h1>Manual Database Sync</h1>
        <p>Click the button below to synchronize the data from the WordPress database to the admin page database. This process may take a few moments.</p>

        <form method="post" action="sync.php">
            <button type="submit" name="run_sync">Run Sync Script Now</button>
        </form>

        <?php if ($script_error): ?>
            <div class="error-box"><?php echo $script_error; ?></div>
        <?php endif; ?>

        <?php if ($script_output): ?>
            <h3>Sync Results</h3>
            <div class="output-box"><?php echo $script_output; ?></div>
        <?php endif; ?>
    </div>

</body>
</html>