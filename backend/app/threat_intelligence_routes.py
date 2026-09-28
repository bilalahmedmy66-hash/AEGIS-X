import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from backend.app.database import get_connection
from backend.app.threat_intelligence import (
    IOCType,
    ThreatIntelRecord,
    normalize_indicator,
)


threat_intel_router = APIRouter(
    prefix="/api/v1/threat-intelligence",
    tags=["Threat Intelligence"],
)


@threat_intel_router.get("")
def list_threat_intelligence(
    indicator_type: IOCType | None = Query(default=None),
    active: bool = True,
):
    connection = get_connection()

    try:
        query = """
            SELECT
                id,
                indicator,
                indicator_type,
                threat_type,
                confidence,
                severity,
                source,
                description,
                tags,
                first_seen,
                last_seen,
                active
            FROM threat_intelligence
            WHERE active = ?
        """
        params: list = [1 if active else 0]

        if indicator_type:
            query += " AND indicator_type = ?"
            params.append(indicator_type.value)

        query += " ORDER BY last_seen DESC, id DESC"

        rows = connection.execute(query, params).fetchall()

        records = []
        for row in rows:
            item = dict(row)
            item["active"] = bool(item["active"])
            item["tags"] = json.loads(item["tags"] or "[]")
            records.append(item)

        return {
            "status": "ok",
            "count": len(records),
            "records": records,
        }
    finally:
        connection.close()


@threat_intel_router.post("", response_model=ThreatIntelRecord)
def add_threat_intelligence(record: ThreatIntelRecord):
    connection = get_connection()

    indicator = normalize_indicator(record.indicator)
    now = datetime.now(timezone.utc).isoformat()
    first_seen = record.first_seen or now
    last_seen = record.last_seen or first_seen

    try:
        connection.execute(
            """
            INSERT INTO threat_intelligence (
                indicator,
                indicator_type,
                threat_type,
                confidence,
                severity,
                source,
                description,
                tags,
                first_seen,
                last_seen,
                active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                indicator,
                record.indicator_type.value,
                record.threat_type,
                record.confidence,
                record.severity,
                record.source,
                record.description,
                json.dumps(record.tags),
                first_seen,
                last_seen,
                1 if record.active else 0,
            ),
        )

        connection.commit()

        return record.model_copy(update={
            "indicator": indicator,
            "first_seen": first_seen,
            "last_seen": last_seen,
        })
    except Exception as exc:
        connection.rollback()
        if "UNIQUE constraint failed" in str(exc):
            raise HTTPException(
                status_code=409,
                detail="Threat intelligence indicator already exists.",
            )
        raise
    finally:
        connection.close()


@threat_intel_router.get("/{indicator}")
def get_threat_intelligence(indicator: str):
    connection = get_connection()

    try:
        row = connection.execute(
            """
            SELECT
                id,
                indicator,
                indicator_type,
                threat_type,
                confidence,
                severity,
                source,
                description,
                tags,
                first_seen,
                last_seen,
                active
            FROM threat_intelligence
            WHERE indicator = ?
            """,
            (normalize_indicator(indicator),),
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail="Threat intelligence indicator not found.",
            )

        item = dict(row)
        item["active"] = bool(item["active"])
        item["tags"] = json.loads(item["tags"] or "[]")

        return item
    finally:
        connection.close()


@threat_intel_router.delete("/{indicator}")
def deactivate_threat_intelligence(indicator: str):
    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            UPDATE threat_intelligence
            SET active = 0
            WHERE indicator = ?
            """,
            (normalize_indicator(indicator),),
        )

        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Threat intelligence indicator not found.",
            )

        return {
            "status": "deactivated",
            "indicator": normalize_indicator(indicator),
        }
    finally:
        connection.close()
