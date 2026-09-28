from pathlib import Path

from backend.app.database import get_connection


def initialize_threat_intelligence() -> None:
    connection = get_connection()

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS threat_intelligence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            indicator TEXT NOT NULL UNIQUE,
            indicator_type TEXT NOT NULL,
            threat_type TEXT NOT NULL,
            confidence INTEGER NOT NULL DEFAULT 50,
            severity TEXT NOT NULL DEFAULT 'MEDIUM',
            source TEXT NOT NULL DEFAULT 'AEGIS_LOCAL',
            description TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            first_seen TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        )
        """
    )

    connection.commit()
    connection.close()
