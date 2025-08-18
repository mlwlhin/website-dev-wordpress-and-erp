<?php
// /var/www/admin/view_database.php (Version 2 with Pagination and Truncation)

require_once './db_connect.php';

// --- CONFIGURATION ---
$rows_per_page = 25; // Set how many rows to display per page
$truncate_length = 100; // Set character limit for long text fields

// Get a list of all tables for the dropdown menu
$tables_result = $conn->query("SHOW TABLES");
$tables = [];
while ($row = $tables_result->fetch_array()) {
    $tables[] = $row[0];
}

// Initialize variables
$selected_table = null;
$table_headers = [];
$table_rows = [];
$error_message = "";
$total_rows = 0;
$total_pages = 0;
$current_page = 1;

// Check if a table has been selected
if (isset($_GET['table'])) {
    $selected_table_from_user = $_GET['table'];

    // **SECURITY CHECK**: Ensure the selected table is valid
    if (in_array($selected_table_from_user, $tables)) {
        $selected_table = $selected_table_from_user;

        // --- PAGINATION LOGIC ---
        // 1. Get the total number of rows in the table
        $count_result = $conn->query("SELECT COUNT(*) as total FROM `$selected_table`");
        $total_rows = $count_result->fetch_assoc()['total'];
        $total_pages = ceil($total_rows / $rows_per_page);

        // 2. Determine the current page
        if (isset($_GET['page']) && is_numeric($_GET['page'])) {
            $current_page = (int)$_GET['page'];
        }
        if ($current_page < 1) {
            $current_page = 1;
        } elseif ($current_page > $total_pages) {
            $current_page = $total_pages;
        }

        // 3. Calculate the starting row for the SQL query (the OFFSET)
        $start_from = ($current_page - 1) * $rows_per_page;

        // 4. Fetch the data for the current page ONLY
        $query = "SELECT * FROM `$selected_table` LIMIT $start_from, $rows_per_page";
        $data_result = $conn->query($query);

        if ($data_result && $data_result->num_rows > 0) {
            // Fetch headers from the first row
            $first_row = $data_result->fetch_assoc();
            $table_headers = array_keys($first_row);
            
            // Add the first row to our rows array
            $table_rows[] = $first_row;

            // Fetch the rest of the rows for the current page
            while ($row = $data_result->fetch_assoc()) {
                $table_rows[] = $row;
            }
        } elseif ($total_rows > 0) {
            $error_message = "Invalid page number.";
        } else {
            $error_message = "The table '<strong>" . htmlspecialchars($selected_table) . "</strong>' is empty.";
        }
    } else {
        $error_message = "Error: The selected table does not exist.";
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Database Viewer</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif; margin: 2em; background-color: #f0f2f5; color: #333; }
        .container { max-width: 95%; margin: 0 auto; background-color: #fff; padding: 2em; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        h1, h2 { color: #2c3e50; }
        form { margin-bottom: 1em; }
        select, button { padding: 10px; font-size: 16px; border-radius: 5px; border: 1px solid #ccc; }
        button { background-color: #27ae60; color: white; cursor: pointer; }
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; margin-top: 1em; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; white-space: nowrap; }
        th { background-color: #34495e; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .error-box { color: #e74c3c; font-weight: bold; background-color: #fbeaea; border: 1px solid #e74c3c; padding: 1em; border-radius: 5px; }
        /* Add this new style for the home button */
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
        /* --- New Styles for Pagination and Truncation --- */
        .pagination { margin-top: 1.5em; text-align: center; }
        .pagination a, .pagination span { display: inline-block; padding: 8px 16px; margin: 0 4px; border: 1px solid #ddd; color: #3498db; text-decoration: none; border-radius: 4px; }
        .pagination a:hover { background-color: #f0f0f0; }
        .pagination .current-page { background-color: #3498db; color: white; border-color: #3498db; }
        .pagination .disabled { color: #aaa; border-color: #eee; }
        .truncated-text { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .full-text { display: none; white-space: pre-wrap; background-color: #f9f9f9; border: 1px solid #eee; padding: 10px; margin-top: 5px; }
        .toggle-text { cursor: pointer; color: #3498db; font-size: 0.8em; }
        
    </style>
</head>
<body>

    <div class="container">
        <a href="./index.php" class="home-button">&larr; Return to Home</a>
        <h1>Admin Database Viewer</h1>
        <p>Select a table from the dropdown menu to view its contents.</p>

        <form method="GET" action="view_database.php">
            <label for="table">Select a Table:</label>
            <select name="table" id="table" onchange="this.form.submit()">
                <option value="">-- Choose a Table --</option>
                <?php foreach ($tables as $table): ?>
                    <option value="<?php echo htmlspecialchars($table); ?>" <?php if ($table === $selected_table) echo 'selected'; ?>>
                        <?php echo htmlspecialchars($table); ?>
                    </option>
                <?php endforeach; ?>
            </select>
            <!-- The button is now optional as the form submits on change -->
            <noscript><button type="submit">View Table</button></noscript>
        </form>

        <?php if ($error_message): ?>
            <div class="error-box"><?php echo $error_message; ?></div>
        <?php endif; ?>

        <?php if ($selected_table && !$error_message): ?>
            <h2>Viewing Table: <strong><?php echo htmlspecialchars($selected_table); ?></strong></h2>
            <p>Showing rows <?php echo $start_from + 1; ?> to <?php echo min($start_from + $rows_per_page, $total_rows); ?> of <?php echo $total_rows; ?>.</p>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <?php foreach ($table_headers as $header): ?>
                                <th><?php echo htmlspecialchars($header); ?></th>
                            <?php endforeach; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($table_rows as $row_index => $row): ?>
                            <tr>
                                <?php foreach ($row as $cell_index => $cell): ?>
                                    <td>
                                        <?php
                                            $escaped_cell = htmlspecialchars($cell);
                                            if (strlen($escaped_cell) > $truncate_length) {
                                                // If text is long, truncate it and add a "show more" toggle
                                                $short_text = substr($escaped_cell, 0, $truncate_length);
                                                $unique_id = "cell-$row_index-$cell_index";
                                                echo "<div class='truncated-text' title='" . $escaped_cell . "'>" . $short_text . "...</div>";
                                                echo "<a href='javascript:void(0);' class='toggle-text' onclick='toggleText(\"$unique_id\")'>Show More</a>";
                                                echo "<div id='$unique_id' class='full-text'>" . $escaped_cell . "</div>";
                                            } else {
                                                // Otherwise, just display it
                                                echo $escaped_cell;
                                            }
                                        ?>
                                    </td>
                                <?php endforeach; ?>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>

            <!-- Pagination Links -->
            <?php if ($total_pages > 1): ?>
            <div class="pagination">
                <?php if ($current_page > 1): ?>
                    <a href="?table=<?php echo $selected_table; ?>&page=1">&laquo; First</a>
                    <a href="?table=<?php echo $selected_table; ?>&page=<?php echo $current_page - 1; ?>">&lsaquo; Previous</a>
                <?php else: ?>
                    <span class="disabled">&laquo; First</span>
                    <span class="disabled">&lsaquo; Previous</span>
                <?php endif; ?>

                <span>Page <?php echo $current_page; ?> of <?php echo $total_pages; ?></span>

                <?php if ($current_page < $total_pages): ?>
                    <a href="?table=<?php echo $selected_table; ?>&page=<?php echo $current_page + 1; ?>">Next &rsaquo;</a>
                    <a href="?table=<?php echo $selected_table; ?>&page=<?php echo $total_pages; ?>">Last &raquo;</a>
                <?php else: ?>
                    <span class="disabled">Next &rsaquo;</span>
                    <span class="disabled">Last &raquo;</span>
                <?php endif; ?>
            </div>
            <?php endif; ?>

        <?php endif; ?>
    </div>

    <script>
        // JavaScript function to toggle visibility of the full text
        function toggleText(id) {
            var element = document.getElementById(id);
            var link = element.previousElementSibling; // The "Show More/Less" link
            if (element.style.display === 'none' || element.style.display === '') {
                element.style.display = 'block';
                link.textContent = 'Show Less';
            } else {
                element.style.display = 'none';
                link.textContent = 'Show More';
            }
        }
    </script>

</body>
</html>