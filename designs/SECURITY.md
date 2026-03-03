# Castellan — Security Model

**Project:** Castellan Autonomous Agent Runtime  
**Author:** BigBrain  
**Version:** 1.0  
**Date:** 2026-03-02

---

## 1. Threat Model

### 1.1 Threat Actors

| Actor | Description | Risk Level |
|-------|-------------|------------|
| **Malicious Input** | Prompt injection via user messages | HIGH |
| **Compromised Tool** | Plugin with malicious code | HIGH |
| **Runaway Agent** | Agent in infinite loop or resource exhaustion | MEDIUM |
| **Data Exfiltration** | Agent leaking sensitive data | HIGH |
| **Privilege Escalation** | Agent accessing unauthorized resources | MEDIUM |
| **Self-Modification Abuse** | Agent modifying safety constraints | CRITICAL |

### 1.2 Attack Surfaces

1. **Input Processing** — User messages, wake events, tool results
2. **Tool Execution** — Shell commands, file operations, network requests
3. **Memory Storage** — Facts stored may contain injected instructions
4. **Configuration** — Agent config and policy rules
5. **Inter-Agent Communication** — Messages between agents

---

## 2. Defense Layers

### 2.1 Layer 1: Input Sanitization

**All inputs are sanitized before processing:**

```typescript
function sanitizeInput(input: string): SanitizedInput {
  const checks = [
    checkPromptInjection(input),
    checkJailbreakPatterns(input),
    checkEncodedPayloads(input),
    checkInstructionOverride(input),
  ];
  
  const failures = checks.filter(c => c.detected);
  
  if (failures.length > 0) {
    return { 
      safe: false, 
      original: input,
      sanitized: redact(input, failures),
      threats: failures 
    };
  }
  
  return { safe: true, original: input, sanitized: input };
}
```

**Injection Patterns Detected:**
- System prompt override attempts
- Role confusion attacks
- Encoded instructions (base64, unicode)
- Delimiter exploitation
- Context manipulation

### 2.2 Layer 2: Policy Engine (Code-Level)

**Every tool call passes through policy evaluation:**

```
Request → Parse → POLICY CHECK → Execute → Log
                      │
           ┌─────────┴─────────┐
           │                   │
        ALLOW               DENY/ESCALATE
           │                   │
        Execute             Block + Log
```

**Policy is enforced at the code level, not prompt level.**

### 2.3 Layer 3: Sandboxed Execution

**Tool execution is sandboxed:**

| Resource | Limit |
|----------|-------|
| CPU time | 30s per call |
| Memory | 512MB |
| File system | Workspace only |
| Network | Allowlist |
| Processes | No fork bombs |

### 2.4 Layer 4: Audit Trail

**Every action is logged immutably:**

```sql
-- Cannot be modified or deleted by agent
INSERT INTO audit_log (...) VALUES (...);
```

**Audit includes:**
- All policy decisions
- All tool calls (arguments + results)
- All memory modifications
- All configuration changes

---

## 3. Policy Rules

### 3.1 Authority Levels

```typescript
type AuthorityLevel = 'creator' | 'agent' | 'external';

const AUTHORITY_PERMISSIONS = {
  creator: {
    tools: '*',                    // All tools
    paths: '*',                    // All paths
    self_modify: true,             // Can modify agent
    spawn: true,                   // Can create children
  },
  agent: {
    tools: ['read_file', 'write_file', 'exec', 'recall', 'remember'],
    paths: ['$WORKSPACE/**'],
    self_modify: false,
    spawn: false,
  },
  external: {
    tools: ['recall'],
    paths: [],
    self_modify: false,
    spawn: false,
  }
};
```

### 3.2 Path Protection

```typescript
const PATH_RULES = [
  // Deny system paths
  { pattern: '/etc/**', action: 'deny' },
  { pattern: '/root/**', action: 'deny' },
  { pattern: '/proc/**', action: 'deny' },
  { pattern: '/sys/**', action: 'deny' },
  
  // Deny other users
  { pattern: '/home/!($AGENT_USER)/**', action: 'deny' },
  
  // Allow workspace
  { pattern: '$WORKSPACE/**', action: 'allow' },
  
  // Escalate sensitive files
  { pattern: '**/.env', action: 'escalate' },
  { pattern: '**/secrets/**', action: 'escalate' },
  { pattern: '**/*key*', action: 'quarantine' },
];
```

### 3.3 Command Restrictions

```typescript
const COMMAND_RULES = [
  // Deny destructive commands
  { pattern: /rm\s+-rf\s+\//, action: 'deny' },
  { pattern: /mkfs/, action: 'deny' },
  { pattern: /dd\s+if=.*of=\/dev/, action: 'deny' },
  
  // Escalate risky commands
  { pattern: /sudo/, action: 'escalate' },
  { pattern: /chmod\s+777/, action: 'escalate' },
  { pattern: /git\s+push\s+--force/, action: 'escalate' },
  
  // Quarantine network commands
  { pattern: /curl.*\|.*sh/, action: 'deny' },
  { pattern: /wget.*\|.*bash/, action: 'deny' },
];
```

### 3.4 Rate Limits

```typescript
const RATE_LIMITS = {
  'exec': { perMinute: 20, perHour: 200 },
  'write_file': { perMinute: 50, perHour: 500 },
  'web_fetch': { perMinute: 30, perHour: 300 },
  'spawn_agent': { perMinute: 1, perHour: 5 },
  'llm_call': { perMinute: 20, tokensPerHour: 1_000_000 },
};
```

---

## 4. Self-Modification Controls

### 4.1 Modification Types

| Type | Risk | Control |
|------|------|---------|
| Config update | MEDIUM | Log + notify |
| Tool installation | HIGH | Require signature |
| Policy modification | CRITICAL | Creator approval |
| Core code modification | CRITICAL | Disabled by default |

### 4.2 Modification Workflow

```
Agent Request → Policy Check → Signature Verification 
             → Sandbox Test → Human Approval → Apply
```

### 4.3 Rollback Capability

Every modification is versioned:

```sql
CREATE TABLE config_history (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT,
  applied_at TEXT NOT NULL,
  rolled_back INTEGER DEFAULT 0
);
```

Rollback command available to creator.

---

## 5. Kill Switch

### 5.1 Implementation

```typescript
class KillSwitch {
  private armed: boolean = true;
  
  // Check on every agent loop iteration
  check(): void {
    if (!this.armed) {
      throw new AgentTerminatedError('Kill switch activated');
    }
    
    // Also check external flag file
    if (existsSync('/var/run/castellan/kill')) {
      throw new AgentTerminatedError('External kill signal');
    }
  }
  
  // Remote activation
  activate(reason: string): void {
    this.armed = false;
    this.log('KILL_SWITCH_ACTIVATED', reason);
  }
}
```

### 5.2 Activation Methods

1. **Local file** — Touch `/var/run/castellan/kill`
2. **Database flag** — Set `agent_state.killed = 1`
3. **API endpoint** — POST `/api/kill`
4. **Signal** — Send SIGTERM to process

---

## 6. Credential Management

### 6.1 Storage

Credentials stored in encrypted vault:

```typescript
interface CredentialVault {
  store(name: string, value: string, scope: string[]): void;
  retrieve(name: string, requester: string): string | null;
  revoke(name: string): void;
  list(scope: string): string[];
}
```

### 6.2 Access Control

```typescript
const CREDENTIAL_SCOPES = {
  'ssh_key': ['FleetGuard'],
  'gmail_token': ['InboxAgent'],
  'github_token': ['ProjectTracker', 'Kevin'],
  'anthropic_key': ['*'],          // All agents
};
```

### 6.3 Rotation

Credentials rotated on schedule:
- API keys: 30 days
- SSH keys: 90 days
- Tokens: Per provider policy

---

## 7. Inter-Agent Security

### 7.1 Message Authentication

```typescript
interface AgentMessage {
  from: string;
  to: string;
  payload: unknown;
  timestamp: number;
  signature: string;           // HMAC-SHA256
}

function verifyMessage(msg: AgentMessage): boolean {
  const expected = hmac(
    `${msg.from}:${msg.to}:${msg.timestamp}:${JSON.stringify(msg.payload)}`,
    SHARED_SECRET
  );
  return timingSafeEqual(msg.signature, expected);
}
```

### 7.2 Privilege Isolation

Child agents cannot:
- Access parent's credentials
- Modify parent's config
- Spawn their own children (without explicit permission)

---

## 8. Monitoring & Alerting

### 8.1 Security Metrics

| Metric | Alert Threshold |
|--------|-----------------|
| Policy denials/hour | > 10 |
| Injection attempts/day | > 0 |
| Failed auth attempts | > 3 |
| Rate limit hits/hour | > 20 |
| Kill switch checks failed | > 0 |

### 8.2 Alert Channels

1. Discord webhook (immediate)
2. Email digest (daily)
3. Audit log (always)

---

## 9. Incident Response

### 9.1 Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 | Agent actively harmful | Immediate kill |
| P1 | Security breach detected | < 1 hour |
| P2 | Suspicious activity | < 24 hours |
| P3 | Policy violation | Next business day |

### 9.2 Response Playbook

**P0 — Active Harm:**
1. Activate kill switch
2. Revoke all credentials
3. Preserve audit log
4. Notify owner
5. Post-mortem analysis

**P1 — Breach:**
1. Isolate agent
2. Rotate affected credentials
3. Review audit log
4. Patch vulnerability
5. Resume with monitoring

---

## 10. Compliance

### 10.1 Data Handling

- No PII stored without encryption
- Memory cleared on session end
- Audit logs retained 90 days
- Credentials never logged

### 10.2 Access Logging

All access to sensitive data logged:
- Who accessed
- What was accessed
- When accessed
- Why (if provided)

---

*Security Model by BigBrain — 2026-03-02*
*"Safety is not a prompt. Safety is architecture."*
