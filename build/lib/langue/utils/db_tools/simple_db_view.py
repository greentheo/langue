#!/usr/bin/env python3
"""
Simple SQLite Database Viewer for Langue

A lightweight script to view the schema and content of the Langue SQLite database
without any external dependencies.
"""

import os
import sys
import sqlite3
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

# Add project directory to path for imports
script_dir = Path(__file__).parent
project_dir = script_dir.parent
if str(project_dir) not in sys.path:
    sys.path.insert(0, str(project_dir))

def get_db_path() -> Path:
    """Get the path to the SQLite database file.

    Returns:
        Path to the database file
    """
    # Try to import from the project first
    try:
        from langue.storage.database import get_db_path as project_get_db_path
        return project_get_db_path()
    except ImportError:
        # Fall back to default location
        return Path.home() / ".local" / "share" / "langue" / "langue.db"

def get_connection() -> sqlite3.Connection:
    """Get a connection to the SQLite database.

    Returns:
        SQLite connection with row factory set to dict
    """
    db_path = get_db_path()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn

def list_tables() -> List[str]:
    """List all tables in the database.

    Returns:
        List of table names
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]

    conn.close()
    return tables

def get_table_schema(table_name: str) -> List[Dict[str, Any]]:
    """Get the schema for a specific table.

    Args:
        table_name: Name of the table

    Returns:
        List of column definitions
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(f"PRAGMA table_info({table_name})")
    schema = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return schema

def get_table_data(table_name: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get data from a table.

    Args:
        table_name: Name of the table
        limit: Maximum number of rows to return

    Returns:
        List of row data
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
    rows = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return rows

def format_value(value: Any) -> str:
    """Format a value for display.

    Args:
        value: Value to format

    Returns:
        Formatted string
    """
    if value is None:
        return "NULL"

    if isinstance(value, str) and (value.startswith('{') or value.startswith('[')):
        try:
            # Try to parse and format JSON
            parsed = json.loads(value)
            return json.dumps(parsed, indent=2)
        except:
            pass

    return str(value)

def print_schema(schema: List[Dict[str, Any]], table_name: str) -> None:
    """Print table schema.

    Args:
        schema: List of column definitions
        table_name: Name of the table
    """
    print(f"\n=== Schema for {table_name} ===")

    # Calculate column widths
    col_widths = {
        "cid": max(3, max([len(str(col.get("cid", ""))) for col in schema] + [0])),
        "name": max(4, max([len(str(col.get("name", ""))) for col in schema] + [0])),
        "type": max(4, max([len(str(col.get("type", ""))) for col in schema] + [0])),
        "notnull": 7,
        "dflt_value": max(10, max([len(str(col.get("dflt_value", ""))) for col in schema] + [0])),
        "pk": 2
    }

    # Print header
    header = (
        f"{'CID'.ljust(col_widths['cid'])} | "
        f"{'Name'.ljust(col_widths['name'])} | "
        f"{'Type'.ljust(col_widths['type'])} | "
        f"{'NotNull'.ljust(col_widths['notnull'])} | "
        f"{'Default'.ljust(col_widths['dflt_value'])} | "
        f"{'PK'.ljust(col_widths['pk'])}"
    )
    print(header)
    print("-" * len(header))

    # Print rows
    for col in schema:
        print(
            f"{str(col.get('cid', '')).ljust(col_widths['cid'])} | "
            f"{str(col.get('name', '')).ljust(col_widths['name'])} | "
            f"{str(col.get('type', '')).ljust(col_widths['type'])} | "
            f"{'Yes' if col.get('notnull') else 'No'.ljust(col_widths['notnull'])} | "
            f"{str(col.get('dflt_value', '')).ljust(col_widths['dflt_value'])} | "
            f"{'Yes' if col.get('pk') else 'No'.ljust(col_widths['pk'])}"
        )

def print_data(rows: List[Dict[str, Any]], table_name: str) -> None:
    """Print table data.

    Args:
        rows: List of row data
        table_name: Name of the table
    """
    if not rows:
        print(f"No data found in {table_name}")
        return

    print(f"\n=== Data from {table_name} ({len(rows)} rows) ===")

    # Get columns from first row
    columns = list(rows[0].keys())

    # Calculate column widths (max 30 chars)
    col_widths = {}
    for col in columns:
        max_val_width = max([len(str(row.get(col, ""))) for row in rows] + [0])
        col_widths[col] = min(30, max(len(col), max_val_width))

    # Print header
    header = " | ".join(col.ljust(col_widths[col]) for col in columns)
    print(header)
    print("-" * len(header))

    # Print rows
    for row in rows:
        values = []
        for col in columns:
            value = format_value(row.get(col, ""))
            # Truncate long values
            if len(value) > col_widths[col]:
                value = value[:col_widths[col]-3] + "..."
            values.append(value.ljust(col_widths[col]))
        print(" | ".join(values))

def print_database_info() -> None:
    """Print information about the database."""
    db_path = get_db_path()

    # Check if database exists
    if not db_path.exists():
        print(f"Database file not found at {db_path}")
        return

    # Get database size
    size_bytes = db_path.stat().st_size
    size_kb = size_bytes / 1024
    size_mb = size_kb / 1024

    # Get modification time
    mod_time = datetime.fromtimestamp(db_path.stat().st_mtime)

    print("\n=== Database Information ===")
    print(f"Path: {db_path}")
    print(f"Size: {size_bytes:,} bytes ({size_kb:.2f} KB, {size_mb:.2f} MB)")
    print(f"Last Modified: {mod_time}")

    # Get table count
    tables = list_tables()
    print(f"Number of Tables: {len(tables)}")

    # Print tables with row counts
    print("\n=== Tables ===")
    conn = get_connection()
    cursor = conn.cursor()

    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"{table}: {count} rows")
        except sqlite3.Error as e:
            print(f"{table}: Error ({e})")

    conn.close()

def print_help() -> None:
    """Print help information."""
    print("\n=== Simple SQLite Database Viewer for Langue ===")
    print("Commands:")
    print("  list                  List all tables")
    print("  schema <table>        Show schema for a table")
    print("  data <table> [limit]  Show data for a table (default limit: 10)")
    print("  info                  Show database information")
    print("  help                  Show this help information")
    print("  exit                  Exit the program")
    print("\nExamples:")
    print("  schema flashcard_history")
    print("  data users 5")

def interactive_mode() -> None:
    """Run in interactive mode."""
    print("Simple SQLite Database Viewer for Langue")
    print("Type 'help' for available commands")

    while True:
        command = input("\n> ").strip()

        if not command:
            continue

        parts = command.split()
        cmd = parts[0].lower()

        if cmd == "exit" or cmd == "quit":
            break

        elif cmd == "help":
            print_help()

        elif cmd == "list":
            tables = list_tables()
            print("\n=== Tables ===")
            for table in tables:
                print(table)

        elif cmd == "schema" and len(parts) > 1:
            table_name = parts[1]
            schema = get_table_schema(table_name)
            print_schema(schema, table_name)

        elif cmd == "data" and len(parts) > 1:
            table_name = parts[1]
            limit = int(parts[2]) if len(parts) > 2 else 10
            rows = get_table_data(table_name, limit)
            print_data(rows, table_name)

        elif cmd == "info":
            print_database_info()

        else:
            print("Unknown command. Type 'help' for available commands.")

def main() -> int:
    """Main entry point.

    Returns:
        Exit code
    """
    # Check if database exists
    db_path = get_db_path()
    if not db_path.exists():
        print(f"Database file not found at {db_path}")
        return 1

    # Parse command line arguments
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()

        if cmd == "list":
            tables = list_tables()
            for table in tables:
                print(table)

        elif cmd == "schema" and len(sys.argv) > 2:
            table_name = sys.argv[2]
            schema = get_table_schema(table_name)
            print_schema(schema, table_name)

        elif cmd == "data" and len(sys.argv) > 2:
            table_name = sys.argv[2]
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            rows = get_table_data(table_name, limit)
            print_data(rows, table_name)

        elif cmd == "info":
            print_database_info()

        elif cmd == "help":
            print_help()

        else:
            print(f"Unknown command: {cmd}")
            print_help()
            return 1

    else:
        # No arguments, run in interactive mode
        interactive_mode()

    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nExiting...")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
