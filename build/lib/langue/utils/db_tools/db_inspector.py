#!/usr/bin/env python3
"""
SQLite Database Inspector for Langue.

This utility script allows you to inspect the contents of the Langue SQLite database.
You can list tables, view schemas, and query data.
"""

import os
import sys
import json
import sqlite3
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

try:
    from rich.console import Console
    from rich.table import Table
    from rich.syntax import Syntax
    from rich.panel import Panel
    from rich.prompt import Prompt
    from rich.tree import Tree
    from rich import box
    has_rich = True
except ImportError:
    has_rich = False
    print("The 'rich' library is not installed. Using simplified output.")

    # Create basic fallback classes
    class Console:
        def __init__(self):
            pass
        def print(self, *args, **kwargs):
            if 'style' in kwargs:
                del kwargs['style']
            print(*args, **kwargs)

# Add parent directory to path for imports if running script directly
script_dir = Path(__file__).parent
if str(script_dir) not in sys.path:
    sys.path.insert(0, str(script_dir.parent))

# Import from langue
from langue.storage.database import get_db_path, get_connection

# Initialize console for output
console = Console() if has_rich else Console()


def get_tables() -> List[str]:
    """Get a list of all tables in the database.

    Returns:
        List of table names
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row['name'] for row in cursor.fetchall()]

    conn.close()
    return tables


def get_table_schema(table_name: str) -> List[Dict[str, Any]]:
    """Get the schema for a specific table.

    Args:
        table_name: Name of the table to get schema for

    Returns:
        List of column definitions
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(f"PRAGMA table_info({table_name})")
        schema = [dict(row) for row in cursor.fetchall()]

        return schema
    except sqlite3.Error as e:
        console.print(f"[red]Error getting schema for {table_name}: {e}[/red]")
        return []
    finally:
        conn.close()


def query_table(table_name: str, limit: int = 20, where: Optional[str] = None,
                order_by: Optional[str] = None) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Query data from a table.

    Args:
        table_name: Name of the table to query
        limit: Maximum number of rows to return
        where: Optional WHERE clause (without the "WHERE" keyword)
        order_by: Optional ORDER BY clause (without the "ORDER BY" keywords)

    Returns:
        Tuple of (rows, column_names)
    """
    conn = get_connection()
    cursor = conn.cursor()

    query = f"SELECT * FROM {table_name}"
    if where:
        query += f" WHERE {where}"
    if order_by:
        query += f" ORDER BY {order_by}"
    query += f" LIMIT {limit}"

    try:
        cursor.execute(query)
        rows = [dict(row) for row in cursor.fetchall()]

        # Get column names
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = [col['name'] for col in cursor.fetchall()]

        return rows, columns
    except sqlite3.Error as e:
        console.print(f"[red]Error querying {table_name}: {e}[/red]")
        return [], []
    finally:
        conn.close()


def execute_sql(sql: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Execute a custom SQL query.

    Args:
        sql: SQL query to execute

    Returns:
        Tuple of (rows, column_names)
    """
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(sql)
        if sql.strip().upper().startswith(('SELECT', 'PRAGMA')):
            rows = [dict(row) for row in cursor.fetchall()]

            # Try to determine column names from the first row
            columns = list(rows[0].keys()) if rows else []

            return rows, columns
        else:
            conn.commit()
            affected = cursor.rowcount
            console.print(f"[green]Query executed successfully. Rows affected: {affected}[/green]")
            return [], []
    except sqlite3.Error as e:
        console.print(f"[red]Error executing SQL: {e}[/red]")
        return [], []
    finally:
        conn.close()


def pretty_print_value(value: Any) -> str:
    """Format a value for pretty printing.

    Args:
        value: Value to format

    Returns:
        Formatted string
    """
    if value is None:
        return "[dim]NULL[/dim]"

    if isinstance(value, str) and (value.startswith('{') or value.startswith('[')):
        try:
            # Try to parse as JSON
            parsed = json.loads(value)
            return json.dumps(parsed, indent=2)
        except:
            pass

    return str(value)


def display_table_data(rows: List[Dict[str, Any]], columns: List[str],
                       table_name: str, truncate: bool = True) -> None:
    """Display table data in a rich table.

    Args:
        rows: List of row data
        columns: List of column names
        table_name: Name of the table
        truncate: Whether to truncate long values
    """
    if not rows:
        console.print(f"No data found in {table_name}")
        return

    if has_rich:
        table = Table(title=f"Data from {table_name}", box=box.ROUNDED)

        # Add columns
        for col in columns:
            table.add_column(col, overflow="fold" if not truncate else "ellipsis")

        # Add rows
        for row in rows:
            values = []
            for col in columns:
                value = row.get(col, "")
                if isinstance(value, str) and len(value) > 50 and truncate:
                    value = value[:47] + "..."
                values.append(pretty_print_value(value))
            table.add_row(*values)

        console.print(table)
        console.print(f"Showing {len(rows)} rows")
    else:
        # Simple table output for when rich is not available
        print(f"Data from {table_name} ({len(rows)} rows):")
        print("-" * 80)

        # Print headers
        header = " | ".join(columns)
        print(header)
        print("-" * 80)

        # Print rows
        for row in rows:
            values = []
            for col in columns:
                value = row.get(col, "")
                if isinstance(value, str) and len(value) > 50 and truncate:
                    value = value[:47] + "..."
                values.append(str(value))
            print(" | ".join(values))
        print("-" * 80)


def display_table_schema(schema: List[Dict[str, Any]], table_name: str) -> None:
    """Display table schema in a rich table.

    Args:
        schema: List of column definitions
        table_name: Name of the table
    """
    if not schema:
        console.print(f"[yellow]No schema found for {table_name}[/yellow]")
        return

    table = Table(title=f"Schema for {table_name}", box=box.ROUNDED)

    # Add columns
    table.add_column("cid", style="dim")
    table.add_column("name", style="green")
    table.add_column("type", style="cyan")
    table.add_column("notnull", style="yellow")
    table.add_column("dflt_value", style="magenta")
    table.add_column("pk", style="red")

    # Add rows
    for col in schema:
        table.add_row(
            str(col.get('cid', '')),
            col.get('name', ''),
            col.get('type', ''),
            '✓' if col.get('notnull') else '✗',
            str(col.get('dflt_value', '')),
            '✓' if col.get('pk') else '✗'
        )

    console.print(table)


def display_tables_list(tables: List[str]) -> None:
    """Display a list of tables in the database.

    Args:
        tables: List of table names
    """
    if not tables:
        console.print("[yellow]No tables found in the database[/yellow]")
        return

    table = Table(title="Database Tables", box=box.ROUNDED)

    table.add_column("Table Name", style="green")
    table.add_column("Row Count", style="cyan")

    # Add rows with row counts
    conn = get_connection()
    cursor = conn.cursor()

    for table_name in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
            count = cursor.fetchone()['count']
            table.add_row(table_name, str(count))
        except sqlite3.Error:
            table.add_row(table_name, "[red]Error[/red]")

    conn.close()

    console.print(table)


def display_database_overview() -> None:
    """Display an overview of the database."""
    db_path = get_db_path()
    tables = get_tables()

    # Get database size
    size_bytes = db_path.stat().st_size
    size_kb = size_bytes / 1024
    size_mb = size_kb / 1024

    # Get modification time
    mod_time = datetime.fromtimestamp(db_path.stat().st_mtime)

    # Create a tree for the overview
    tree = Tree("Database Overview")
    tree.add(f"Path: [cyan]{db_path}[/cyan]")
    tree.add(f"Size: [cyan]{size_bytes:,} bytes[/cyan] ({size_kb:.2f} KB, {size_mb:.2f} MB)")
    tree.add(f"Last Modified: [cyan]{mod_time}[/cyan]")
    tree.add(f"Tables: [cyan]{len(tables)}[/cyan]")

    console.print(Panel(tree, title="Langue Database", border_style="green"))


def interactive_mode() -> None:
    """Run the database inspector in interactive mode."""
    console.print("[bold cyan]Langue Database Inspector - Interactive Mode[/bold cyan]")
    display_database_overview()

    while True:
        console.print("\n[bold green]Choose an option:[/bold green]")
        console.print("1. List all tables")
        console.print("2. View table schema")
        console.print("3. Query table data")
        console.print("4. Execute custom SQL")
        console.print("5. View database overview")
        console.print("0. Exit")

        choice = Prompt.ask("Enter your choice", choices=["0", "1", "2", "3", "4", "5"], default="1")

        if choice == "0":
            break
        elif choice == "1":
            tables = get_tables()
            display_tables_list(tables)
        elif choice == "2":
            tables = get_tables()
            display_tables_list(tables)
            table_name = Prompt.ask("Enter table name to view schema", choices=tables)
            schema = get_table_schema(table_name)
            display_table_schema(schema, table_name)
        elif choice == "3":
            tables = get_tables()
            display_tables_list(tables)
            table_name = Prompt.ask("Enter table name to query", choices=tables)

            limit = int(Prompt.ask("Limit results to", default="20"))
            where = Prompt.ask("WHERE clause (optional)", default="")
            order_by = Prompt.ask("ORDER BY clause (optional)", default="")

            rows, columns = query_table(table_name, limit, where or None, order_by or None)
            display_table_data(rows, columns, table_name)
        elif choice == "4":
            sql = Prompt.ask("Enter SQL query")
            rows, columns = execute_sql(sql)
            if rows:
                display_table_data(rows, columns, "Custom Query")
        elif choice == "5":
            display_database_overview()


def main():
    """Main entry point for the database inspector."""
    parser = argparse.ArgumentParser(description="SQLite Database Inspector for Langue")
    parser.add_argument("--list-tables", action="store_true", help="List all tables in the database")
    parser.add_argument("--schema", metavar="TABLE", help="View schema for a specific table")
    parser.add_argument("--query", metavar="TABLE", help="Query data from a specific table")
    parser.add_argument("--limit", type=int, default=20, help="Limit query results (default: 20)")
    parser.add_argument("--where", help="WHERE clause for query (without 'WHERE' keyword)")
    parser.add_argument("--order-by", help="ORDER BY clause for query (without 'ORDER BY' keywords)")
    parser.add_argument("--sql", help="Execute a custom SQL query")
    parser.add_argument("--interactive", "-i", action="store_true", help="Run in interactive mode")

    args = parser.parse_args()

    # Check if rich is available
    if not has_rich and args.interactive:
        print("Interactive mode requires the 'rich' library. Please install it with 'pip install rich'")
        return 1

    # Check if database exists
    db_path = get_db_path()
    if not db_path.exists():
        console.print(f"Database file not found at {db_path}")
        return 1

    # If no arguments provided, default to interactive mode
    if len(sys.argv) == 1 or args.interactive:
        interactive_mode()
        return 0

    # Process command line arguments
    if args.list_tables:
        tables = get_tables()
        display_tables_list(tables)

    if args.schema:
        schema = get_table_schema(args.schema)
        display_table_schema(schema, args.schema)

    if args.query:
        rows, columns = query_table(args.query, args.limit, args.where, args.order_by)
        display_table_data(rows, columns, args.query)

    if args.sql:
        rows, columns = execute_sql(args.sql)
        if rows:
            display_table_data(rows, columns, "Custom Query")

    return 0


if __name__ == "__main__":
    sys.exit(main())
