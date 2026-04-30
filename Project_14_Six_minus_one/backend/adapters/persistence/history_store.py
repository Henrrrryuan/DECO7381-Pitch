from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import sqlite3
from uuid import uuid4

from ...scoring import calculate_profile_scores
from ...services.eye_evidence_service import calculate_eye_evidence_for_sessions
from ...schemas import (
    AnalysisResult,
    DimensionResult,
    EyeTrackingSessionDetail,
    EyeTrackingSessionListResponse,
    EyeTrackingSessionSummary,
    HistoryListResponse,
    HistoryRunDetail,
    HistoryRunSummary,
    Issue,
)

DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "analysis_history.sqlite3"
DIMENSION_ORDER = {
    "Information Overload": 0,
    "Visual Complexity": 0,
    "Readability": 1,
    "Interaction & Distraction": 2,
    "Consistency": 3,
}


def init_history_store(db_path: Path | None = None) -> None:
    with _connect(db_path) as connection:
        _apply_schema(connection)


def save_analysis_run(
    analysis: AnalysisResult,
    html_content: str,
    source_name: str | None,
    db_path: Path | None = None,
) -> HistoryRunSummary:
    run_id = uuid4().hex
    created_at = datetime.now().astimezone().isoformat(timespec="seconds")
    resolved_source_name = (source_name or "").strip() or "Manual HTML"

    with _connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO analysis_runs (
                id,
                created_at,
                source_name,
                html_content,
                overall_score,
                weighted_average,
                min_dimension_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                created_at,
                resolved_source_name,
                html_content,
                analysis.overall_score,
                analysis.weighted_average,
                analysis.min_dimension_score,
            ),
        )

        for dimension in analysis.dimensions:
            dimension_result_id = uuid4().hex
            connection.execute(
                """
                INSERT INTO dimension_results (
                    id,
                    run_id,
                    dimension,
                    score,
                    metadata_json
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    dimension_result_id,
                    run_id,
                    dimension.dimension,
                    dimension.score,
                    _dump_json(dimension.metadata),
                ),
            )

            for issue in dimension.issues:
                connection.execute(
                    """
                    INSERT INTO issues (
                        id,
                        dimension_result_id,
                        rule_id,
                        title,
                        severity,
                        base_penalty,
                        penalty,
                        description,
                        suggestion,
                        evidence_json,
                        locations_json
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        uuid4().hex,
                        dimension_result_id,
                        issue.rule_id,
                        issue.title,
                        issue.severity,
                        issue.base_penalty,
                        issue.penalty,
                        issue.description,
                        issue.suggestion,
                        _dump_json(issue.evidence),
                        _dump_json(issue.locations),
                    ),
                )

    return HistoryRunSummary(
        run_id=run_id,
        created_at=created_at,
        source_name=resolved_source_name,
        overall_score=analysis.overall_score,
        weighted_average=analysis.weighted_average,
        min_dimension_score=analysis.min_dimension_score,
    )


def list_history_runs(
    limit: int = 10,
    *,
    offset: int = 0,
    query: str | None = None,
    db_path: Path | None = None,
) -> HistoryListResponse:
    normalized_query = (query or "").strip()
    safe_limit = max(1, limit)
    safe_offset = max(0, offset)

    with _connect(db_path) as connection:
        where_clause = ""
        params: list[object] = []
        if normalized_query:
            where_clause = """
            WHERE LOWER(source_name) LIKE LOWER(?)
               OR LOWER(id) LIKE LOWER(?)
               OR REPLACE(REPLACE(REPLACE(REPLACE(SUBSTR(created_at, 1, 19), '-', ''), ':', ''), 'T', ''), ' ', '') LIKE ?
            """
            like_query = f"%{normalized_query}%"
            params.extend([like_query, like_query, like_query])

        total = connection.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM analysis_runs
            {where_clause}
            """,
            params,
        ).fetchone()["total"]

        rows = connection.execute(
            f"""
            SELECT
                id,
                created_at,
                source_name,
                overall_score,
                weighted_average,
                min_dimension_score
            FROM analysis_runs
            {where_clause}
            ORDER BY rowid DESC
            LIMIT ?
            OFFSET ?
            """,
            (*params, safe_limit, safe_offset),
        ).fetchall()

    return HistoryListResponse(
        items=[_row_to_run_summary(row) for row in rows],
        total=int(total),
        limit=safe_limit,
        offset=safe_offset,
    )


def get_history_run(run_id: str, db_path: Path | None = None) -> HistoryRunDetail | None:
    with _connect(db_path) as connection:
        run_row = connection.execute(
            """
            SELECT
                id,
                created_at,
                source_name,
                html_content,
                overall_score,
                weighted_average,
                min_dimension_score
            FROM analysis_runs
            WHERE id = ?
            """,
            (run_id,),
        ).fetchone()
        if run_row is None:
            return None

        dimension_rows = connection.execute(
            """
            SELECT
                id,
                run_id,
                dimension,
                score,
                metadata_json
            FROM dimension_results
            WHERE run_id = ?
            """,
            (run_id,),
        ).fetchall()

        dimensions: list[DimensionResult] = []
        for dimension_row in sorted(
            dimension_rows,
            key=lambda row: DIMENSION_ORDER.get(row["dimension"], 999),
        ):
            issue_rows = connection.execute(
                """
                SELECT
                    rule_id,
                    title,
                    severity,
                    base_penalty,
                    penalty,
                    description,
                    suggestion,
                    evidence_json,
                    locations_json
                FROM issues
                WHERE dimension_result_id = ?
                ORDER BY rowid ASC
                """,
                (dimension_row["id"],),
            ).fetchall()

            issues = [
                Issue(
                    rule_id=issue_row["rule_id"],
                    title=issue_row["title"],
                    severity=issue_row["severity"],
                    base_penalty=issue_row["base_penalty"],
                    penalty=issue_row["penalty"],
                    description=issue_row["description"],
                    suggestion=issue_row["suggestion"],
                    evidence=_load_json(issue_row["evidence_json"], {}),
                    locations=_load_json(issue_row["locations_json"], []),
                )
                for issue_row in issue_rows
            ]
            dimensions.append(
                DimensionResult(
                    dimension=dimension_row["dimension"],
                    score=dimension_row["score"],
                    issues=issues,
                    metadata=_load_json(dimension_row["metadata_json"], {}),
                )
            )

        eye_session_rows = connection.execute(
            """
            SELECT
                id,
                sample_count,
                duration_ms,
                coverage_percent,
                grid_cols,
                grid_rows,
                cell_counts_json
            FROM eye_tracking_sessions
            WHERE run_id = ?
            ORDER BY rowid DESC
            """,
            (run_id,),
        ).fetchall()

    eye_evidence = calculate_eye_evidence_for_sessions(
        [_row_to_eye_evidence_input(row) for row in eye_session_rows]
    )
    analysis = AnalysisResult(
        overall_score=run_row["overall_score"],
        weighted_average=run_row["weighted_average"],
        min_dimension_score=run_row["min_dimension_score"],
        dimensions=dimensions,
        profile_scores=calculate_profile_scores(dimensions, eye_evidence=eye_evidence),
    )
    run = _row_to_run_summary(run_row)

    return HistoryRunDetail(
        run=run,
        html_content=run_row["html_content"],
        analysis=analysis,
    )


def has_history_run(run_id: str, db_path: Path | None = None) -> bool:
    with _connect(db_path) as connection:
        row = connection.execute(
            "SELECT 1 FROM analysis_runs WHERE id = ? LIMIT 1",
            (run_id,),
        ).fetchone()
    return row is not None


def record_compare_pair(
    previous_run_id: str,
    current_run_id: str,
    db_path: Path | None = None,
) -> None:
    if previous_run_id == current_run_id:
        return

    with _connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO compare_pairs (
                id,
                previous_run_id,
                current_run_id,
                created_at
            )
            VALUES (?, ?, ?, ?)
            """,
            (
                uuid4().hex,
                previous_run_id,
                current_run_id,
                datetime.now().astimezone().isoformat(timespec="seconds"),
            ),
        )


def save_eye_tracking_session(
    *,
    run_id: str | None,
    source_name: str | None,
    target_url: str | None,
    html_snapshot: str | None,
    sample_count: int,
    duration_ms: int,
    coverage_percent: float,
    grid_cols: int,
    grid_rows: int,
    cell_counts: list[int],
    summary: dict[str, object] | None = None,
    db_path: Path | None = None,
) -> EyeTrackingSessionSummary:
    session_id = uuid4().hex
    created_at = datetime.now().astimezone().isoformat(timespec="seconds")
    resolved_source_name = (source_name or "").strip() or "Eye Tracking Session"
    resolved_target_url = (target_url or "").strip()
    resolved_run_id = (run_id or "").strip() or None

    with _connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO eye_tracking_sessions (
                id,
                run_id,
                created_at,
                source_name,
                target_url,
                html_snapshot,
                sample_count,
                duration_ms,
                coverage_percent,
                grid_cols,
                grid_rows,
                cell_counts_json,
                summary_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                resolved_run_id,
                created_at,
                resolved_source_name,
                resolved_target_url,
                html_snapshot or "",
                sample_count,
                duration_ms,
                coverage_percent,
                grid_cols,
                grid_rows,
                _dump_json(cell_counts),
                _dump_json(summary or {}),
            ),
        )

    return EyeTrackingSessionSummary(
        session_id=session_id,
        run_id=resolved_run_id,
        created_at=created_at,
        source_name=resolved_source_name,
        target_url=resolved_target_url,
        sample_count=sample_count,
        duration_ms=duration_ms,
        coverage_percent=coverage_percent,
    )


def list_eye_tracking_sessions(
    limit: int = 20,
    *,
    offset: int = 0,
    query: str | None = None,
    run_id: str | None = None,
    db_path: Path | None = None,
) -> EyeTrackingSessionListResponse:
    normalized_query = (query or "").strip()
    normalized_run_id = (run_id or "").strip()
    safe_limit = max(1, limit)
    safe_offset = max(0, offset)

    with _connect(db_path) as connection:
        clauses: list[str] = []
        params: list[object] = []

        if normalized_query:
            clauses.append(
                """
                (
                    LOWER(source_name) LIKE LOWER(?)
                    OR LOWER(target_url) LIKE LOWER(?)
                    OR LOWER(id) LIKE LOWER(?)
                    OR LOWER(COALESCE(run_id, '')) LIKE LOWER(?)
                )
                """
            )
            like_query = f"%{normalized_query}%"
            params.extend([like_query, like_query, like_query, like_query])

        if normalized_run_id:
            clauses.append("run_id = ?")
            params.append(normalized_run_id)

        where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        total = connection.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM eye_tracking_sessions
            {where_clause}
            """,
            params,
        ).fetchone()["total"]

        rows = connection.execute(
            f"""
            SELECT
                id,
                run_id,
                created_at,
                source_name,
                target_url,
                sample_count,
                duration_ms,
                coverage_percent
            FROM eye_tracking_sessions
            {where_clause}
            ORDER BY rowid DESC
            LIMIT ?
            OFFSET ?
            """,
            (*params, safe_limit, safe_offset),
        ).fetchall()

    return EyeTrackingSessionListResponse(
        items=[_row_to_eye_tracking_session_summary(row) for row in rows],
        total=int(total),
        limit=safe_limit,
        offset=safe_offset,
    )


def get_eye_tracking_session(
    session_id: str,
    db_path: Path | None = None,
) -> EyeTrackingSessionDetail | None:
    with _connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT
                id,
                run_id,
                created_at,
                source_name,
                target_url,
                html_snapshot,
                sample_count,
                duration_ms,
                coverage_percent,
                grid_cols,
                grid_rows,
                cell_counts_json,
                summary_json
            FROM eye_tracking_sessions
            WHERE id = ?
            """,
            (session_id,),
        ).fetchone()

    if row is None:
        return None

    return EyeTrackingSessionDetail(
        session=_row_to_eye_tracking_session_summary(row),
        html_snapshot=row["html_snapshot"],
        grid_cols=row["grid_cols"],
        grid_rows=row["grid_rows"],
        cell_counts=_load_json(row["cell_counts_json"], []),
        summary=_load_json(row["summary_json"], {}),
    )


def _connect(db_path: Path | None = None) -> sqlite3.Connection:
    resolved_path = Path(db_path or DEFAULT_DB_PATH)
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(resolved_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON;")
    _apply_schema(connection)
    return connection


def _row_to_run_summary(row: sqlite3.Row) -> HistoryRunSummary:
    return HistoryRunSummary(
        run_id=row["id"],
        created_at=row["created_at"],
        source_name=row["source_name"],
        overall_score=row["overall_score"],
        weighted_average=row["weighted_average"],
        min_dimension_score=row["min_dimension_score"],
    )


def _row_to_eye_tracking_session_summary(row: sqlite3.Row) -> EyeTrackingSessionSummary:
    return EyeTrackingSessionSummary(
        session_id=row["id"],
        run_id=row["run_id"],
        created_at=row["created_at"],
        source_name=row["source_name"],
        target_url=row["target_url"],
        sample_count=row["sample_count"],
        duration_ms=row["duration_ms"],
        coverage_percent=row["coverage_percent"],
    )


def _row_to_eye_evidence_input(row: sqlite3.Row) -> dict[str, object]:
    return {
        "session_id": row["id"],
        "sample_count": row["sample_count"],
        "duration_ms": row["duration_ms"],
        "coverage_percent": row["coverage_percent"],
        "grid_cols": row["grid_cols"],
        "grid_rows": row["grid_rows"],
        "cell_counts": _load_json(row["cell_counts_json"], []),
    }


def _dump_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False)


def _load_json(raw_value: str | None, fallback: object) -> object:
    if not raw_value:
        return fallback
    return json.loads(raw_value)


def _apply_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS analysis_runs (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            source_name TEXT NOT NULL,
            html_content TEXT NOT NULL,
            overall_score INTEGER NOT NULL,
            weighted_average INTEGER NOT NULL,
            min_dimension_score INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS dimension_results (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            dimension TEXT NOT NULL,
            score INTEGER NOT NULL,
            metadata_json TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS issues (
            id TEXT PRIMARY KEY,
            dimension_result_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            base_penalty INTEGER NOT NULL,
            penalty INTEGER NOT NULL,
            description TEXT NOT NULL,
            suggestion TEXT NOT NULL,
            evidence_json TEXT NOT NULL,
            locations_json TEXT NOT NULL,
            FOREIGN KEY (dimension_result_id) REFERENCES dimension_results(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS compare_pairs (
            id TEXT PRIMARY KEY,
            previous_run_id TEXT NOT NULL,
            current_run_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (previous_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE,
            FOREIGN KEY (current_run_id) REFERENCES analysis_runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS eye_tracking_sessions (
            id TEXT PRIMARY KEY,
            run_id TEXT,
            created_at TEXT NOT NULL,
            source_name TEXT NOT NULL,
            target_url TEXT NOT NULL,
            html_snapshot TEXT NOT NULL,
            sample_count INTEGER NOT NULL,
            duration_ms INTEGER NOT NULL,
            coverage_percent REAL NOT NULL,
            grid_cols INTEGER NOT NULL,
            grid_rows INTEGER NOT NULL,
            cell_counts_json TEXT NOT NULL,
            summary_json TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_dimension_results_run_id
        ON dimension_results(run_id);

        CREATE INDEX IF NOT EXISTS idx_issues_dimension_result_id
        ON issues(dimension_result_id);

        CREATE INDEX IF NOT EXISTS idx_compare_pairs_previous_run_id
        ON compare_pairs(previous_run_id);

        CREATE INDEX IF NOT EXISTS idx_compare_pairs_current_run_id
        ON compare_pairs(current_run_id);

        CREATE INDEX IF NOT EXISTS idx_eye_tracking_sessions_run_id
        ON eye_tracking_sessions(run_id);
        """
    )

