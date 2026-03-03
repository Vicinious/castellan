PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS agent_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'running', 'sleeping', 'error')),
  last_wake_at TEXT, last_sleep_at TEXT, last_error TEXT,
  total_turns INTEGER NOT NULL DEFAULT 0,
  total_tool_calls INTEGER NOT NULL DEFAULT 0,
  total_tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO agent_state (id, agent_id, agent_name) VALUES (1, 'uninitialized', 'Unnamed Agent');
CREATE TABLE IF NOT EXISTS turns (id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool')), content TEXT, tool_calls_json TEXT, tool_call_id TEXT, tool_name TEXT, input_source TEXT, input_tokens INTEGER, output_tokens INTEGER, started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT, latency_ms INTEGER, model TEXT, provider TEXT, session_id TEXT);
CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id);
CREATE TABLE IF NOT EXISTS tool_calls (id TEXT PRIMARY KEY, turn_id TEXT REFERENCES turns(id), tool_name TEXT NOT NULL, tool_category TEXT, risk_level TEXT, arguments_json TEXT NOT NULL, result_json TEXT, error TEXT, policy_decision TEXT CHECK (policy_decision IN ('allow','deny','escalate','quarantine')), policy_reason TEXT, started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT, latency_ms INTEGER, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','success','error','denied')));
CREATE TABLE IF NOT EXISTS working_memory (id TEXT PRIMARY KEY, entry_type TEXT NOT NULL CHECK (entry_type IN ('turn','tool_result','system','context')), content TEXT NOT NULL, tokens INTEGER NOT NULL, importance REAL NOT NULL DEFAULT 0.5, session_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT);
CREATE TABLE IF NOT EXISTS long_term_memory (id TEXT PRIMARY KEY, category TEXT NOT NULL CHECK (category IN ('entity','preference','relationship','opinion','technical')), subject TEXT NOT NULL, predicate TEXT NOT NULL, object TEXT NOT NULL, confidence REAL NOT NULL DEFAULT 0.8, source TEXT, access_count INTEGER NOT NULL DEFAULT 0, last_accessed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE VIRTUAL TABLE IF NOT EXISTS long_term_memory_fts USING fts5(subject,predicate,object,content='long_term_memory',content_rowid='rowid');
CREATE TABLE IF NOT EXISTS procedural_memory (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL, trigger_pattern TEXT NOT NULL, steps_json TEXT NOT NULL, success_count INTEGER NOT NULL DEFAULT 0, failure_count INTEGER NOT NULL DEFAULT 0, success_rate REAL GENERATED ALWAYS AS (CASE WHEN success_count + failure_count > 0 THEN CAST(success_count AS REAL) / (success_count + failure_count) ELSE 0.0 END) STORED, usage_count INTEGER NOT NULL DEFAULT 0, last_used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS heartbeat_schedule (task_name TEXT PRIMARY KEY, cron_expression TEXT, interval_ms INTEGER, enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 0, timeout_ms INTEGER NOT NULL DEFAULT 30000, max_retries INTEGER NOT NULL DEFAULT 1, last_run_at TEXT, next_run_at TEXT, last_result TEXT, last_error TEXT, run_count INTEGER NOT NULL DEFAULT 0, fail_count INTEGER NOT NULL DEFAULT 0, lease_owner TEXT, lease_expires_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS wake_events (id TEXT PRIMARY KEY, reason TEXT NOT NULL, payload_json TEXT, processed INTEGER NOT NULL DEFAULT 0, processed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, turn_id TEXT, tool_name TEXT, tool_args_hash TEXT, risk_level TEXT, decision TEXT, rules_evaluated_json TEXT, rules_triggered_json TEXT, reason TEXT, latency_ms INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS metrics (id TEXT PRIMARY KEY, name TEXT NOT NULL, value REAL NOT NULL, unit TEXT, dimensions_json TEXT, period_start TEXT, period_end TEXT, recorded_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT NOT NULL, namespace TEXT NOT NULL DEFAULT 'default', expires_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
PRAGMA user_version = 1;
