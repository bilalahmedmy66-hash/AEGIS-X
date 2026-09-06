import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "aegis.db"


def get_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row

    return connection


def initialize_database() -> None:
    connection = get_connection()

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS security_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            source TEXT NOT NULL,
            user TEXT,
            source_ip TEXT,
            description TEXT NOT NULL,
            severity INTEGER NOT NULL,
            timestamp TEXT NOT NULL
        )
        """
    )

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS security_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            risk_score INTEGER NOT NULL,
            risk_level TEXT NOT NULL,
            source_ip TEXT,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'NEW',
            created_at TEXT NOT NULL
        )
        """
    )
    columns = connection.execute(
        "PRAGMA table_info(security_alerts)"
    ).fetchall()

    column_names = [column["name"] for column in columns]

    if "status" not in column_names:
        connection.execute(
            """
            ALTER TABLE security_alerts
            ADD COLUMN status TEXT NOT NULL DEFAULT 'NEW'
            """
        )


    connection.commit()
    connection.close()