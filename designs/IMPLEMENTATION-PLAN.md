# Castellan — Implementation Plan

**Project:** Castellan Autonomous Agent Runtime  
**Author:** BigBrain  
**Version:** 1.0  
**Date:** 2026-03-02

---

## Overview

This document outlines the phased implementation plan for Castellan. Total estimated time: **4-6 weeks** with the standard SDLC pipeline.

---

## Phase Summary

| Phase | Name | Duration | Dependencies |
|-------|------|----------|--------------|
| 1 | Foundation | 1 week | None |
| 2 | Agent Core | 1 week | Phase 1 |
| 3 | Memory System | 1 week | Phase 1 |
| 4 | Tool System | 1 week | Phase 2 |
| 5 | Heartbeat | 3 days | Phase 1, 2 |
| 6 | Provider Layer | 3 days | Phase 2 |
| 7 | Integration | 1 week | All above |
| 8 | First Agents | 1 week | Phase 7 |

---

## Phase 1: Foundation (Week 1)

### Objective
Establish project structure, database layer, and configuration system.

### Deliverables

**1.1 Project Structure**
```
castellan/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── loader.ts
│   ├── db/
│   │   ├── index.ts
│   │   ├── database.ts
│   │   ├── migrations/
│   │   │   └── 001_initial.sql
│   │   └── queries/
│   └── utils/
│       ├── logger.ts
│       ├── ulid.ts
│       └── errors.ts
├── tests/
├── config/
│   └── default.json
└── docs/
```

**1.2 Database Layer**
- SQLite wrapper with better-sqlite3
- Migration system
- All tables from DATABASE.md
- Query helpers

**1.3 Configuration System**
- JSON config loading
- Environment variable override
- Schema validation (Zod)
- Runtime config access

**1.4 Logging**
- Structured JSON logging
- Log levels (debug, info, warn, error)
- Correlation IDs

### Acceptance Criteria
- [ ] `npm run build` succeeds
- [ ] Database migrations run
- [ ] Config loads from file + env
- [ ] Logger outputs JSON

---

## Phase 2: Agent Core (Week 2)

### Objective
Implement the ReAct loop and basic agent lifecycle.

### Deliverables

**2.1 Agent Loop**
```
src/agent/
├── index.ts
├── loop.ts              # ReAct implementation
├── context.ts           # Context assembly
├── turn.ts              # Turn processing
└── state.ts             # State machine
```

**2.2 System Prompt**
- Base system prompt template
- Agent identity injection
- Tool availability injection
- Memory context injection

**2.3 Turn Processing**
- Context assembly
- LLM call (mock provider initially)
- Response parsing
- Tool call extraction
- Turn persistence

**2.4 Safety Limits**
- Max tool calls per turn
- Max consecutive errors
- Repetitive turn detection
- Turn timeout

### Acceptance Criteria
- [ ] Agent can run a simple turn
- [ ] Tool calls are extracted
- [ ] Turns are persisted to DB
- [ ] Safety limits trigger appropriately

---

## Phase 3: Memory System (Week 3)

### Objective
Implement 3-tier memory with retrieval and consolidation.

### Deliverables

**3.1 Working Memory**
```
src/memory/
├── index.ts
├── working.ts           # Session context
├── long-term.ts         # Semantic facts
├── procedural.ts        # Procedures
├── retrieval.ts         # Memory search
└── consolidation.ts     # Memory compression
```

**3.2 Long-Term Memory**
- Fact storage (SPO triples)
- FTS5 search integration
- Confidence scoring
- Access tracking

**3.3 Procedural Memory**
- Procedure storage
- Step sequencing
- Success rate tracking
- Pattern matching

**3.4 Memory Operations**
- Store fact
- Recall facts (by query)
- Store procedure
- Recall procedures (by task)
- Consolidate (working → long-term)

**3.5 Token Budgeting**
- Per-tier token limits
- Context assembly within budget
- Priority-based pruning

### Acceptance Criteria
- [ ] Facts stored and retrieved
- [ ] FTS search works
- [ ] Procedures stored and matched
- [ ] Token budget enforced
- [ ] Consolidation reduces working memory

---

## Phase 4: Tool System (Week 4)

### Objective
Implement tool registry, execution pipeline, and core tools.

### Deliverables

**4.1 Tool Framework**
```
src/tools/
├── index.ts
├── registry.ts          # Tool registration
├── executor.ts          # Execution pipeline
├── validator.ts         # Argument validation
└── core/
    ├── shell.ts
    ├── file.ts
    ├── memory.ts
    └── web.ts
```

**4.2 Core Tools**
| Tool | Category | Risk |
|------|----------|------|
| exec | shell | MEDIUM |
| read_file | file | LOW |
| write_file | file | MEDIUM |
| delete_file | file | HIGH |
| recall | memory | LOW |
| remember | memory | LOW |
| web_fetch | web | MEDIUM |
| web_search | web | LOW |

**4.3 Execution Pipeline**
1. Parse tool call
2. Validate arguments (JSON Schema)
3. Policy check
4. Execute with timeout
5. Capture result/error
6. Log to DB

**4.4 Policy Engine**
```
src/policy/
├── index.ts
├── engine.ts
├── rules/
│   ├── authority.ts
│   ├── paths.ts
│   ├── commands.ts
│   └── rate-limits.ts
└── audit.ts
```

### Acceptance Criteria
- [ ] Tools registered and callable
- [ ] Arguments validated
- [ ] Policy decisions logged
- [ ] Rate limits enforced
- [ ] Dangerous commands blocked

---

## Phase 5: Heartbeat Daemon (Days 1-3, Week 5)

### Objective
Implement background task scheduler and wake events.

### Deliverables

**5.1 Scheduler**
```
src/heartbeat/
├── index.ts
├── daemon.ts
├── scheduler.ts
├── tasks/
│   ├── health.ts
│   ├── consolidation.ts
│   └── metrics.ts
└── wake.ts
```

**5.2 Task Management**
- Cron expression parsing
- DB-backed schedule
- Lease-based execution
- Error handling + retry

**5.3 Built-in Tasks**
- Health check
- Memory consolidation
- Metric snapshot
- Stale cleanup

**5.4 Wake Events**
- Event creation
- Event processing
- Agent wake trigger

### Acceptance Criteria
- [ ] Tasks execute on schedule
- [ ] Cron expressions work
- [ ] No duplicate execution
- [ ] Wake events trigger agent

---

## Phase 6: Provider Layer (Days 4-6, Week 5)

### Objective
Implement LLM provider abstraction and routing.

### Deliverables

**6.1 Provider Abstraction**
```
src/providers/
├── index.ts
├── interface.ts
├── router.ts
├── anthropic.ts
├── openai.ts
└── ollama.ts
```

**6.2 Provider Implementations**
- Anthropic (Claude)
- OpenAI (GPT)
- Ollama (local)

**6.3 Model Router**
- Task-type routing rules
- Cost optimization
- Fallback chains
- Token counting

### Acceptance Criteria
- [ ] All providers work
- [ ] Router selects appropriate model
- [ ] Fallback on failure
- [ ] Token usage tracked

---

## Phase 7: Integration (Week 6)

### Objective
Wire all components together and implement OpenClaw integration.

### Deliverables

**7.1 Full Runtime**
- Agent + Heartbeat running together
- All components integrated
- End-to-end turn execution

**7.2 OpenClaw Integration**
- Gateway registration
- Skill loading as tools
- Channel messaging
- Cron integration

**7.3 CLI Interface**
```bash
castellan start          # Start agent
castellan stop           # Stop agent
castellan status         # Show status
castellan wake           # Manual wake
castellan run <task>     # Run heartbeat task
castellan config         # Show config
```

**7.4 Systemd Service**
```ini
[Unit]
Description=Castellan Agent
After=network.target

[Service]
Type=simple
User=castellan
WorkingDirectory=/opt/castellan
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

### Acceptance Criteria
- [ ] Full runtime starts and runs
- [ ] OpenClaw gateway sees agent
- [ ] CLI commands work
- [ ] Systemd service operational

---

## Phase 8: First Agents (Week 7)

### Objective
Deploy first specialist agents using Castellan runtime.

### Target Agents

**8.1 FleetGuard**
- Domain: Server monitoring
- Tools: SSH, exec, file
- Tasks: Health checks, log analysis, alerts

**8.2 ContentEngine** (if time permits)
- Domain: Content publishing
- Tools: File, web, CMS API
- Tasks: Content generation, publishing

### Per-Agent Deliverables
- Agent config (SOUL, tools, schedule)
- Custom tools (plugins)
- Heartbeat tasks
- Integration tests

### Acceptance Criteria
- [ ] FleetGuard running 24/7
- [ ] Health checks executing
- [ ] Alerts delivered
- [ ] No crashes in 48h

---

## Milestones

| Milestone | Target Date | Deliverable |
|-----------|-------------|-------------|
| M1 | End Week 1 | Foundation complete |
| M2 | End Week 2 | Agent runs turns |
| M3 | End Week 3 | Memory operational |
| M4 | End Week 4 | Tools working |
| M5 | End Week 5 | Heartbeat + Providers |
| M6 | End Week 6 | Full runtime |
| M7 | End Week 7 | First agent deployed |

---

## SDLC Pipeline

Each phase follows standard pipeline:

```
Design (BigBrain) → Implementation (Monkey) → 
Review (BigBrain) → SIT (DumDum) → SQT (Boss) → Deploy
```

### Batch Structure

Each phase broken into implementation batches:
- ~1-2 days per batch
- Clear deliverables
- Testable independently

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Scope creep | Strict phase boundaries |
| Integration issues | Interface contracts early |
| Performance problems | Benchmarks each phase |
| Security gaps | Review at each milestone |

---

## Dependencies

### External
- Node.js 22+ (node:sqlite)
- better-sqlite3
- Anthropic SDK
- OpenAI SDK

### Internal
- OpenClaw Gateway (optional)
- Existing skills (optional)

---

## Success Criteria

**Phase 8 Complete When:**
1. FleetGuard runs 48h without crash
2. Heartbeat tasks execute reliably
3. Memory persists across restarts
4. Policy blocks dangerous actions
5. Audit log captures all actions
6. Documentation complete

---

*Implementation Plan by BigBrain — 2026-03-02*
*"Build the castle one stone at a time."*
