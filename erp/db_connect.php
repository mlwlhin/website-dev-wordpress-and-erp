<?php
// /var/www/admin/db_connect.php

define('DB_HOST', 'localhost');
define('DB_USER', 'admin_sbgp');
define('DB_PASSWORD', 'SocioBridge5501#');
define('DB_NAME', 'admin_page_db');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

if ($conn->connect_error) {
    die("Database Connection Failed: " . $conn->connect_error);
}
$conn->set_charset("utf8mb4");
?>