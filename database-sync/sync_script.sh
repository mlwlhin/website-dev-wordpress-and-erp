#!/bin/bash

# --- Configuration ---
# Common Host (since both are on the same VM)
DB_HOST="localhost"

# WordPress Database
WP_DB_NAME="wordpress"
WP_DB_USER="wordpress"
# IMPORTANT: Replace with your actual WordPress database password
WP_DB_PASS="EfltYFVj"

# Admin Database
ADMIN_DB_NAME="admin_page_db"
ADMIN_DB_USER="admin_sbgp"
# IMPORTANT: Replace with your actual admin database password
ADMIN_DB_PASS="SocioBridge5501#"

# --- Tables to Synchronize ---
# This is a list of tables you want to copy from the WordPress database.
# Each table name must have a corresponding table in the admin database
# with the exact same schema.
SOURCE_TABLES=("wp_psychometric_results" "wp_wpforms_entries" "wp_wpforms_entry_fields" "wp_wpforms_entry_meta")

# --- Synchronization Function ---
# This function handles the synchronization process for a single table.
synchronize_table() {
  local SOURCE_TABLE="$1"
  local DESTINATION_TABLE="$1" # Using the same name for simplicity

  echo "Starting synchronization of table '${SOURCE_TABLE}' from '${WP_DB_NAME}' to '${ADMIN_DB_NAME}'."

  # Temporary file to store the exported data
  TEMP_FILE="/tmp/${SOURCE_TABLE}.sql"

  # 1. Export data from the WordPress database
  mysqldump -h "$DB_HOST" -u "$WP_DB_USER" -p"$WP_DB_PASS" --single-transaction "$WP_DB_NAME" "$SOURCE_TABLE" > "$TEMP_FILE"

  if [ $? -eq 0 ]; then
    echo "Successfully exported data from '${SOURCE_TABLE}'."
  else
    echo "Error exporting data from '${SOURCE_TABLE}'. Aborting."
    rm -f "$TEMP_FILE"
    return 1
  fi

  # 2. Clear the destination table and import the new data
  # The TRUNCATE command will remove all rows from the destination table.
  mysql -h "$DB_HOST" -u "$ADMIN_DB_USER" -p"$ADMIN_DB_PASS" -D "$ADMIN_DB_NAME" -e "TRUNCATE TABLE \`${DESTINATION_TABLE}\`"

  if [ $? -ne 0 ]; then
    echo "Error clearing destination table '${DESTINATION_TABLE}'. Aborting."
    rm -f "$TEMP_FILE"
    return 1
  fi
  echo "Successfully cleared destination table '${DESTINATION_TABLE}'."

  # The imported data includes the CREATE TABLE statement, but we don't want to recreate the table.
  # We just want to import the data, which is done by piping the SQL file.
  mysql -h "$DB_HOST" -u "$ADMIN_DB_USER" -p"$ADMIN_DB_PASS" -D "$ADMIN_DB_NAME" < "$TEMP_FILE"

  if [ $? -eq 0 ]; then
    echo "Successfully imported data into '${DESTINATION_TABLE}'."
  else
    echo "Error importing data into '${DESTINATION_TABLE}'. Aborting."
    rm -f "$TEMP_FILE"
    return 1
  fi

  echo "Synchronization complete. Temporary file removed."
  rm -f "$TEMP_FILE"
  echo "------------------------------------------------------"
  return 0
}

# --- Main Logic ---
# Iterate through the list of tables and synchronize each one.
for table in "${SOURCE_TABLES[@]}"; do
  synchronize_table "$table"
done

echo "All table synchronizations have completed."
