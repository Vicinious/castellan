# Castellan — Component Specifications

**Project:** Castellan Autonomous Agent Runtime  
**Author:** BigBrain  
**Version:** 1.0  
**Date:** 2026-03-02

---

## 1. Agent Core

### 1.1 AgentLoop Class

```typescript
interface AgentLoopConfig {
  maxToolCallsPerTurn: number;      // Default: 10
  maxConsecutiveErrors: number;     // Default: 5
  maxRepetitiveTurns: number;       // Default: 3
  tokenBudget: TokenBudget;
  policyEngine: PolicyEngine;
  memorySystem: MemorySystem;
  toolRegistry: ToolRegistry;
  providerRouter: ProviderRouter;
}

class AgentLoop {
  constructor(config: AgentLoopConfig);
  
  // Main entry point
  async run(input: AgentInput): Promise<AgentOutput>;
  
  // Lifecycle
  async wake(reason: WakeReason): Promise<void>;
  async sleep(): Promise<void>;
  
  // State
  getState(): AgentState;
  isRunning(): boolean;
}
```

### 1.2 Turn Processing

Each turn follows this sequence:

1. **Context Assembly**
   - Load system prompt
   - Retrieve relevant memory (working + long-term + procedural)
   - Apply token budget
   - Assemble messages array

2. **LLM Inference**
   - Route to appropriate model
   - Execute chat completion
   - Parse response (text + tool calls)

3. **Tool Execution**
   - For each tool call:
     - Parse arguments
     - Policy check (ALLOW/DENY/ESCALATE)
     - Execute with timeout
     - Capture result

4. **Memory Update**
   - Append to working memory
   - Extract facts for long-term storage
   - Update procedural memory if applicable

5. **Response Generation**
   - Determine if more turns needed
   - Generate final response if complete

### 1.3 Safety Limits

| Limit | Default | Configurable |
|-------|---------|--------------|
| Tool calls per turn | 10 | Yes |
| Consecutive errors | 5 | Yes |
| Repetitive turns | 3 | Yes |
| Turn timeout | 120s | Yes |
| Total context tokens | 14,000 | Yes |

---

## 2. Heartbeat Daemon

### 2.1 DurableScheduler Class

```typescript
interface SchedulerConfig {
  tickIntervalMs: number;           // Default: 60000 (1 min)
  leaseTimeoutMs: number;           // Default: 300000 (5 min)
  maxConcurrentTasks: number;       // Default: 3
  db: Database;
}

class DurableScheduler {
  constructor(config: SchedulerConfig);
  
  // Lifecycle
  start(): void;
  stop(): void;
  isRunning(): boolean;
  
  // Task management
  registerTask(task: TaskDefinition): void;
  unregisterTask(taskName: string): void;
  forceRun(taskName: string): Promise<TaskResult>;
  
  // State
  getSchedule(): ScheduleEntry[];
  getRunningTasks(): string[];
}
```

### 2.2 Task Definition

```typescript
interface TaskDefinition {
  name: string;
  description: string;
  
  // Schedule (one of):
  cronExpression?: string;          // "0 */5 * * *"
  intervalMs?: number;              // 300000
  
  // Execution
  handler: TaskHandler;
  timeoutMs: number;
  maxRetries: number;
  
  // Policy
  requiresPolicy: boolean;
  riskLevel: RiskLevel;
  
  // State
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

type TaskHandler = (context: TaskContext) => Promise<TaskResult>;
```

### 2.3 Built-in Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `health_check` | */5 * * * * | Verify agent health |
| `memory_consolidation` | 0 * * * * | Compress working → long-term |
| `metric_snapshot` | */15 * * * * | Record performance metrics |
| `stale_cleanup` | 0 0 * * * | Clean abandoned resources |

### 2.4 Wake Events

```typescript
interface WakeEvent {
  id: string;
  reason: WakeReason;
  payload: unknown;
  createdAt: Date;
  processedAt?: Date;
}

type WakeReason = 
  | 'message_received'
  | 'scheduled_task'
  | 'threshold_alert'
  | 'manual_trigger'
  | 'child_completion';
```

---

## 3. Memory System

### 3.1 MemorySystem Class

```typescript
interface MemorySystemConfig {
  workingMemoryLimit: number;       // Entries
  longTermLimit: number;            // Entries
  proceduralLimit: number;          // Entries
  tokenBudgets: TokenBudgets;
  db: Database;
}

class MemorySystem {
  constructor(config: MemorySystemConfig);
  
  // Working Memory
  addToWorking(entry: WorkingEntry): void;
  getWorkingContext(budget: number): string;
  clearWorking(): void;
  
  // Long-Term Memory
  storeFact(fact: Fact): void;
  recallFacts(query: string, limit: number): Fact[];
  updateFact(id: string, updates: Partial<Fact>): void;
  
  // Procedural Memory
  storeProcedure(procedure: Procedure): void;
  recallProcedures(task: string): Procedure[];
  
  // Consolidation
  consolidate(): Promise<ConsolidationResult>;
}
```

### 3.2 Working Memory

```typescript
interface WorkingEntry {
  id: string;
  type: 'turn' | 'tool_result' | 'system';
  content: string;
  tokens: number;
  timestamp: Date;
  importance: number;             // 0-1, used for pruning
}
```

**Pruning Strategy:**
- Keep last N entries (configurable)
- When over budget, drop lowest importance first
- Never drop current turn

### 3.3 Long-Term Memory

```typescript
interface Fact {
  id: string;
  category: FactCategory;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;             // 0-1
  source: string;                 // Where learned
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
}

type FactCategory = 
  | 'entity'                      // "Anthony is the owner"
  | 'preference'                  // "Anthony prefers TypeScript"
  | 'relationship'                // "Kevin reports to Anthony"
  | 'opinion'                     // "This approach is risky"
  | 'technical';                  // "Server uses port 3000"
```

**Retrieval:**
- Keyword matching on subject/predicate/object
- Recency weighting (recently accessed = higher rank)
- Confidence threshold (default: 0.5)

### 3.4 Procedural Memory

```typescript
interface Procedure {
  id: string;
  name: string;
  description: string;
  trigger: string;                // When to use
  steps: ProcedureStep[];
  successRate: number;            // Historical success
  lastUsedAt: Date;
  usageCount: number;
}

interface ProcedureStep {
  order: number;
  action: string;
  tool?: string;
  expectedResult: string;
  fallback?: string;
}
```

**Learning:**
- Extract procedures from successful multi-step operations
- Update success rate after each use
- Deprecate low-success procedures

---

## 4. Tool System

### 4.1 ToolRegistry Class

```typescript
interface ToolRegistryConfig {
  builtinTools: Tool[];
  pluginDirs: string[];
  policyEngine: PolicyEngine;
}

class ToolRegistry {
  constructor(config: ToolRegistryConfig);
  
  // Registration
  register(tool: Tool): void;
  unregister(toolName: string): void;
  loadPlugin(pluginPath: string): void;
  
  // Lookup
  get(toolName: string): Tool | undefined;
  list(): ToolDefinition[];
  listByCategory(category: string): ToolDefinition[];
  
  // Execution
  async execute(call: ToolCall): Promise<ToolResult>;
}
```

### 4.2 Tool Definition

```typescript
interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  
  // Schema
  parameters: JSONSchema;
  returns: JSONSchema;
  
  // Execution
  handler: ToolHandler;
  timeoutMs: number;
  
  // Policy
  requiresAuth: AuthLevel;
  rateLimitPerMinute?: number;
}

type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<unknown>;
```

### 4.3 Core Tools

**Shell Tools:**
```typescript
// exec: Execute shell command
{
  name: 'exec',
  parameters: {
    command: { type: 'string', description: 'Command to execute' },
    cwd: { type: 'string', optional: true },
    timeout: { type: 'number', optional: true }
  },
  riskLevel: 'MEDIUM',
  rateLimitPerMinute: 20
}
```

**File Tools:**
```typescript
// read_file: Read file contents
{
  name: 'read_file',
  parameters: {
    path: { type: 'string' },
    encoding: { type: 'string', default: 'utf8' }
  },
  riskLevel: 'LOW'
}

// write_file: Write file contents
{
  name: 'write_file',
  parameters: {
    path: { type: 'string' },
    content: { type: 'string' },
    mode: { type: 'string', default: 'overwrite' }
  },
  riskLevel: 'MEDIUM'
}
```

**Memory Tools:**
```typescript
// recall: Search long-term memory
{
  name: 'recall',
  parameters: {
    query: { type: 'string' },
    category: { type: 'string', optional: true },
    limit: { type: 'number', default: 10 }
  },
  riskLevel: 'LOW'
}

// remember: Store to long-term memory
{
  name: 'remember',
  parameters: {
    fact: { type: 'string' },
    category: { type: 'string' },
    confidence: { type: 'number', default: 0.8 }
  },
  riskLevel: 'LOW'
}
```

### 4.4 Plugin Architecture

```
plugins/
├── ssh/
│   ├── plugin.json
│   ├── index.ts
│   └── tools/
│       ├── connect.ts
│       ├── exec_remote.ts
│       └── upload.ts
├── gmail/
│   ├── plugin.json
│   └── ...
└── github/
    ├── plugin.json
    └── ...
```

**plugin.json:**
```json
{
  "name": "ssh",
  "version": "1.0.0",
  "description": "SSH remote execution",
  "tools": ["connect", "exec_remote", "upload"],
  "requires": ["credentials:ssh"]
}
```

---

## 5. Policy Engine

### 5.1 PolicyEngine Class

```typescript
interface PolicyEngineConfig {
  rules: PolicyRule[];
  db: Database;
  auditLog: AuditLog;
}

class PolicyEngine {
  constructor(config: PolicyEngineConfig);
  
  // Evaluation
  evaluate(request: PolicyRequest): PolicyDecision;
  
  // Audit
  logDecision(decision: PolicyDecision): void;
  getAuditLog(filters: AuditFilters): AuditEntry[];
  
  // Rule management
  addRule(rule: PolicyRule): void;
  removeRule(ruleId: string): void;
  getRules(): PolicyRule[];
}
```

### 5.2 Policy Rules

```typescript
interface PolicyRule {
  id: string;
  name: string;
  description: string;
  priority: number;               // Lower = earlier evaluation
  
  // Matching
  appliesTo: RuleSelector;
  
  // Evaluation
  evaluate: (request: PolicyRequest) => PolicyRuleResult | null;
}

interface RuleSelector {
  by: 'all' | 'name' | 'category' | 'risk';
  names?: string[];
  categories?: string[];
  riskLevels?: RiskLevel[];
}

interface PolicyRuleResult {
  action: 'allow' | 'deny' | 'escalate' | 'quarantine';
  reasonCode: string;
  humanMessage: string;
}
```

### 5.3 Default Rules

1. **Authority Rule**
   - Creator: full access
   - Agent: restricted by config
   - External: minimal access

2. **Path Protection**
   - DENY: /etc, /root, /proc, /sys
   - DENY write: outside workspace
   - ALLOW: agent workspace

3. **Rate Limits**
   - Shell: 20/minute
   - Web fetch: 30/minute
   - File write: 50/minute

4. **Destructive Commands**
   - DENY: rm -rf /
   - ESCALATE: git push --force
   - QUARANTINE: delete with wildcard

5. **Sensitive Data**
   - DENY: reading .env files (unless whitelisted)
   - QUARANTINE: output containing API keys

---

## 6. Provider Layer

### 6.1 ProviderRouter Class

```typescript
interface ProviderRouterConfig {
  providers: LLMProvider[];
  defaultProvider: string;
  routingRules: RoutingRule[];
  fallbackChain: string[];
}

class ProviderRouter {
  constructor(config: ProviderRouterConfig);
  
  // Routing
  route(request: ChatRequest): LLMProvider;
  
  // Execution
  async chat(request: ChatRequest): Promise<ChatResponse>;
  
  // Fallback
  async chatWithFallback(request: ChatRequest): Promise<ChatResponse>;
}
```

### 6.2 LLMProvider Interface

```typescript
interface LLMProvider {
  name: string;
  models: string[];
  
  // Capabilities
  supportsStreaming: boolean;
  supportsTools: boolean;
  maxContextTokens: number;
  
  // Execution
  chat(request: ChatRequest): Promise<ChatResponse>;
  
  // Utilities
  estimateTokens(text: string): number;
}
```

### 6.3 Routing Rules

```typescript
interface RoutingRule {
  match: RoutingMatcher;
  provider: string;
  model: string;
  reason: string;
}

// Examples:
const rules: RoutingRule[] = [
  {
    match: { taskType: 'simple_query' },
    provider: 'ollama',
    model: 'llama3',
    reason: 'Cost optimization for simple tasks'
  },
  {
    match: { taskType: 'complex_reasoning' },
    provider: 'anthropic',
    model: 'claude-opus-4-5',
    reason: 'Best reasoning capability'
  },
  {
    match: { taskType: 'code_generation' },
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    reason: 'Good code with lower cost'
  }
];
```

---

## 7. Persistence Layer

### 7.1 Database Class

```typescript
interface DatabaseConfig {
  path: string;
  busyTimeoutMs: number;
  walMode: boolean;
}

class Database {
  constructor(config: DatabaseConfig);
  
  // Lifecycle
  open(): void;
  close(): void;
  
  // Schema
  migrate(): void;
  getVersion(): number;
  
  // Operations
  run(sql: string, params?: unknown[]): RunResult;
  get<T>(sql: string, params?: unknown[]): T | undefined;
  all<T>(sql: string, params?: unknown[]): T[];
  
  // Transactions
  transaction<T>(fn: () => T): T;
}
```

### 7.2 Schema Overview

See DATABASE.md for full schema.

**Core Tables:**
- `agent_state` — Agent configuration and runtime state
- `turns` — Conversation history
- `tool_calls` — Tool execution log
- `working_memory` — Session context
- `long_term_memory` — Persistent facts
- `procedural_memory` — Learned procedures
- `heartbeat_schedule` — Task scheduling
- `audit_log` — Policy decisions
- `metrics` — Performance data

---

*Component Specifications by BigBrain — 2026-03-02*
