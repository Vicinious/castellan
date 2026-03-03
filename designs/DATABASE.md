# Castellan — Database Schema

**Project:** Castellan Autonomous Agent Runtime  
**Author:** BigBrain  
**Version:** 1.0  
**Date:** 2026-03-02

---

## Overview

Castellan uses SQLite for all persistence. The schema is designed for:
- Single-agent deployment (one DB per agent)
- Fast reads for context assembly
- Append-mostly writes (audit trail)
- Easy backup and migration

---

## Schema Version

Current: **v1**

Migrations stored in `migrations/` directory.

---

## Tables

### 1. agent_state

Agent configuration and runtime state.

```sql
CREATE TABLE agent_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  
  -- Identity
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  
  -- Configuration
  config_json TEXT NOT NULL DEFAULT '{}',
  
  -- Runtime State
  state TEXT NOT NULL DEFAULT 'idle'
    CHECK (state IN ('idle', 'running', 'sleeping', 'error')),
  last_wake_at TEXT,
  last_sleep_at TEXT,
  last_error TEXT,
  
  -- Statistics
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_tool_calls INTEGER NOT NULL DEFAULT 0,
  total_tokens_used INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO agent_state (id, agent_id, agent_name) 
VALUES (1, 'uninitialized', 'Unnamed Agent');
```

### 2. turns

Conversation history.

```sql
CREATE TABLE turns (
  id TEXT PRIMARY KEY,                    -- ULID
  
  -- Turn Data
  role TEXT NOT NULL 
    CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  
  -- Tool Calls (if assistant with tools)
  tool_calls_json TEXT,                   -- JSON array of tool calls
  
  -- Tool Result (if role='tool')
  tool_call_id TEXT,
  tool_name TEXT,
  
  -- Context
  input_source TEXT,                      -- 'user', 'heartbeat', 'wake_event'
  input_tokens INTEGER,
  output_tokens INTEGER,
  
  -- Timing
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  latency_ms INTEGER,
  
  -- Metadata
  model TEXT,
  provider TEXT,
  
  -- Indexes
  session_id TEXT
);

CREATE INDEX idx_turns_session ON turns(session_id);
CREATE INDEX idx_turns_started ON turns(started_at);
```

### 3. tool_calls

Detailed tool execution log.

```sql
CREATE TABLE tool_calls (
  id TEXT PRIMARY KEY,                    -- ULID
  turn_id TEXT REFERENCES turns(id),
  
  -- Tool Info
  tool_name TEXT NOT NULL,
  tool_category TEXT,
  risk_level TEXT,
  
  -- Arguments & Result
  arguments_json TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  
  -- Policy
  policy_decision TEXT 
    CHECK (policy_decision IN ('allow', 'deny', 'escalate', 'quarantine')),
  policy_reason TEXT,
  
  -- Timing
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  latency_ms INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'success', 'error', 'denied'))
);

CREATE INDEX idx_tool_calls_turn ON tool_calls(turn_id);
CREATE INDEX idx_tool_calls_name ON tool_calls(tool_name);
CREATE INDEX idx_tool_calls_started ON tool_calls(started_at);
```

### 4. working_memory

Session-scoped context (ephemeral).

```sql
CREATE TABLE working_memory (
  id TEXT PRIMARY KEY,                    -- ULID
  
  -- Entry Data
  entry_type TEXT NOT NULL 
    CHECK (entry_type IN ('turn', 'tool_result', 'system', 'context')),
  content TEXT NOT NULL,
  
  -- Token Budget
  tokens INTEGER NOT NULL,
  
  -- Importance (for pruning)
  importance REAL NOT NULL DEFAULT 0.5,
  
  -- Session Tracking
  session_id TEXT NOT NULL,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT                         -- For auto-cleanup
);

CREATE INDEX idx_working_session ON working_memory(session_id);
CREATE INDEX idx_working_created ON working_memory(created_at);
```

### 5. long_term_memory

Persistent semantic facts.

```sql
CREATE TABLE long_term_memory (
  id TEXT PRIMARY KEY,                    -- ULID
  
  -- Fact Structure (SPO triple)
  category TEXT NOT NULL 
    CHECK (category IN ('entity', 'preference', 'relationship', 'opinion', 'technical')),
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  
  -- Confidence & Source
  confidence REAL NOT NULL DEFAULT 0.8,
  source TEXT,                            -- Turn ID or 'initial'
  
  -- Access Tracking (for retrieval ranking)
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ltm_category ON long_term_memory(category);
CREATE INDEX idx_ltm_subject ON long_term_memory(subject);
CREATE INDEX idx_ltm_accessed ON long_term_memory(last_accessed_at);

-- Full-text search
CREATE VIRTUAL TABLE long_term_memory_fts USING fts5(
  subject, predicate, object,
  content='long_term_memory',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER ltm_ai AFTER INSERT ON long_term_memory BEGIN
  INSERT INTO long_term_memory_fts(rowid, subject, predicate, object)
  VALUES (new.rowid, new.subject, new.predicate, new.object);
END;

CREATE TRIGGER ltm_ad AFTER DELETE ON long_term_memory BEGIN
  INSERT INTO long_term_memory_fts(long_term_memory_fts, rowid, subject, predicate, object)
  VALUES ('delete', old.rowid, old.subject, old.predicate, old.object);
END;

CREATE TRIGGER ltm_au AFTER UPDATE ON long_term_memory BEGIN
  INSERT INTO long_term_memory_fts(long_term_memory_fts, rowid, subject, predicate, object)
  VALUES ('delete', old.rowid, old.subject, old.predicate, old.object);
  INSERT INTO long_term_memory_fts(rowid, subject, predicate, object)
  VALUES (new.rowid, new.subject, new.predicate, new.object);
END;
```

### 6. procedural_memory

Learned how-to procedures.

```sql
CREATE TABLE procedural_memory (
  id TEXT PRIMARY KEY,                    -- ULID
  
  -- Procedure Info
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL,          -- When to use
  
  -- Steps
  steps_json TEXT NOT NULL,               -- JSON array of ProcedureStep
  
  -- Performance Tracking
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL GENERATED ALWAYS AS (
    CASE WHEN success_count + failure_count > 0 
    THEN CAST(success_count AS REAL) / (success_count + failure_count)
    ELSE 0.0 END
  ) STORED,
  
  -- Usage
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_proc_trigger ON procedural_memory(trigger_pattern);
CREATE INDEX idx_proc_success ON procedural_memory(success_rate);
```

### 7. heartbeat_schedule

Background task scheduling.

```sql
CREATE TABLE heartbeat_schedule (
  task_name TEXT PRIMARY KEY,
  
  -- Schedule
  cron_expression TEXT,
  interval_ms INTEGER,
  
  -- Configuration
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 1,
  
  -- State
  last_run_at TEXT,
  next_run_at TEXT,
  last_result TEXT,
  last_error TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  
  -- Lease (prevents duplicate execution)
  lease_owner TEXT,
  lease_expires_at TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_hb_next ON heartbeat_schedule(next_run_at);
CREATE INDEX idx_hb_enabled ON heartbeat_schedule(enabled);
```

### 8. wake_events

Events that trigger agent wake-up.

```sql
CREATE TABLE wake_events (
  id TEXT PRIMARY KEY,                    -- ULID
  
  -- Event Data
  reason TEXT NOT NULL,
  payload_json TEXT,
  
  -- Processing
  processed INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_wake_processed ON wake_events(processed);
CREATE INDEX idx_wake_created ON wake_events(created_at);
```

### 9. audit_log

Policy decisions and security events.

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,                    -- ULID
  
  -- Event Type
  event_type TEXT NOT NULL,               -- 'policy_decision', 'security_alert', etc.
  
  -- Context
  turn_id TEXT,
  tool_name TEXT,
  tool_args_hash TEXT,                    -- SHA256 of arguments
  
  -- Policy Decision
  risk_level TEXT,
  decision TEXT,
  rules_evaluated_json TEXT,
  rules_triggered_json TEXT,
  reason TEXT,
  
  -- Timing
  latency_ms INTEGER,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_type ON audit_log(event_type);
CREATE INDEX idx_audit_turn ON audit_log(turn_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);
```

### 10. metrics

Performance and usage metrics.

```sql
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,                    -- ULID
  
  -- Metric Data
  name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  
  -- Dimensions
  dimensions_json TEXT,                   -- {"provider": "anthropic", "model": "claude-3"}
  
  -- Aggregation
  period_start TEXT,
  period_end TEXT,
  
  -- Timestamps
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_recorded ON metrics(recorded_at);
```

### 11. kv_store

Generic key-value storage for plugins.

```sql
CREATE TABLE kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  
  -- Metadata
  namespace TEXT NOT NULL DEFAULT 'default',
  expires_at TEXT,
  
  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_kv_namespace ON kv_store(namespace);
CREATE INDEX idx_kv_expires ON kv_store(expires_at);
```

---

## Migrations

### Migration v1 (Initial)

```sql
-- migrations/001_initial.sql

-- All CREATE TABLE statements above

PRAGMA user_version = 1;
```

### Migration Template

```sql
-- migrations/NNN_description.sql

BEGIN TRANSACTION;

-- Schema changes here

PRAGMA user_version = N;

COMMIT;
```

---

## Query Patterns

### Get Recent Context

```sql
SELECT content, tokens
FROM working_memory
WHERE session_id = ?
ORDER BY created_at DESC
LIMIT 20;
```

### Search Long-Term Memory

```sql
SELECT m.*, 
       bm25(long_term_memory_fts) as relevance
FROM long_term_memory m
JOIN long_term_memory_fts fts ON m.rowid = fts.rowid
WHERE long_term_memory_fts MATCH ?
ORDER BY relevance
LIMIT 10;
```

### Get Due Heartbeat Tasks

```sql
SELECT *
FROM heartbeat_schedule
WHERE enabled = 1
  AND (lease_owner IS NULL OR datetime(lease_expires_at) < datetime('now'))
  AND (next_run_at IS NULL OR datetime(next_run_at) <= datetime('now'))
ORDER BY priority ASC, next_run_at ASC;
```

### Record Token Usage

```sql
INSERT INTO metrics (id, name, value, unit, dimensions_json)
VALUES (?, 'tokens_used', ?, 'tokens', ?);
```

---

## Backup Strategy

```bash
# Daily backup
sqlite3 agent.db ".backup backup-$(date +%Y%m%d).db"

# Keep 7 days
find . -name "backup-*.db" -mtime +7 -delete
```

---

## Performance Notes

1. **WAL Mode** — Enabled for better concurrent read/write
2. **Busy Timeout** — 5000ms to handle lock contention
3. **Indexes** — On all frequently-queried columns
4. **FTS5** — For semantic memory search
5. **Generated Columns** — For computed fields (success_rate)

---

*Database Schema by BigBrain — 2026-03-02*
