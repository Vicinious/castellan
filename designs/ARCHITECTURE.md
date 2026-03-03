# Castellan — Architecture Specification

**Project:** Castellan Autonomous Agent Runtime  
**Author:** BigBrain  
**Version:** 1.0  
**Date:** 2026-03-02  
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy](#2-design-philosophy)
3. [System Overview](#3-system-overview)
4. [Core Components](#4-core-components)
5. [Data Flow](#5-data-flow)
6. [Integration Points](#6-integration-points)
7. [Deployment Model](#7-deployment-model)

---

## 1. Executive Summary

### 1.1 What Is Castellan?

Castellan is a **persistent autonomous agent runtime** — a framework for creating AI agents that:
- Run continuously without human prompting
- Maintain memory across sessions
- Execute background tasks on schedules
- Self-improve through procedural learning
- Spawn specialist sub-agents
- Operate within strict safety boundaries

### 1.2 Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Safety First** | Policy engine with code-level enforcement, not prompt-level |
| **Provider Agnostic** | Abstract LLM interface, swap providers without code changes |
| **Self-Hosted** | No external dependencies, runs entirely on our infrastructure |
| **Observable** | Structured logging, metrics, audit trails for all actions |
| **Extensible** | Plugin architecture for tools, providers, and capabilities |
| **OpenClaw Native** | Integrates with existing OpenClaw ecosystem |

### 1.3 What Castellan Is NOT

- Not a chatbot framework (though agents can converse)
- Not a crypto/blockchain project (no wallets, no tokens)
- Not a "survival economics" experiment (agents serve humans, not themselves)
- Not a Conway Cloud integration (provider-agnostic by design)

---

## 2. Design Philosophy

### 2.1 Agents Serve The Kingdom

Unlike Conway's survival-economics model, Castellan agents exist to **extend human capability**, not to ensure their own survival. The "survival pressure" is replaced with **mission alignment** — agents succeed when they accomplish their assigned purpose.

```
Conway Model:                    Castellan Model:
┌─────────────────┐              ┌─────────────────┐
│ Agent survives  │              │ Human succeeds  │
│ if it earns $   │              │ via agent work  │
└─────────────────┘              └─────────────────┘
    ↑ pressure                       ↑ alignment
```

### 2.2 Safety Through Architecture

Conway's constitution is prompt-level safety — the agent is *instructed* to follow rules. Castellan implements **code-level safety** — dangerous actions are blocked at the policy engine before reaching execution.

```
Prompt-Level Safety:             Code-Level Safety:
┌─────────────────┐              ┌─────────────────┐
│ "Don't do X"    │              │ if (isX(action))│
│ (can be ignored)│              │   return DENY   │
└─────────────────┘              └─────────────────┘
```

### 2.3 Simplicity Over Features

Conway's codebase is 62K lines. Castellan targets **15-20K lines** for the core runtime. We achieve this by:
- 3-tier memory instead of 5
- No crypto/wallet infrastructure
- No Conway Cloud integration
- Focused tool set (expandable via plugins)

---

## 3. System Overview

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CASTELLAN RUNTIME                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐    ┌──────────────────────┐               │
│  │     AGENT CORE       │    │   HEARTBEAT DAEMON   │               │
│  │  ┌────────────────┐  │    │  ┌────────────────┐  │               │
│  │  │  Agent Loop    │  │    │  │  Scheduler     │  │               │
│  │  │  (ReAct)       │  │    │  │  (Cron-based)  │  │               │
│  │  └───────┬────────┘  │    │  └───────┬────────┘  │               │
│  │          │           │    │          │           │               │
│  │  ┌───────▼────────┐  │    │  ┌───────▼────────┐  │               │
│  │  │  Tool Router   │  │    │  │  Task Runner   │  │               │
│  │  └───────┬────────┘  │    │  └───────┬────────┘  │               │
│  │          │           │    │          │           │               │
│  │  ┌───────▼────────┐  │    │  ┌───────▼────────┐  │               │
│  │  │  Policy Engine │◄─┼────┼──│  Policy Engine │  │               │
│  │  └────────────────┘  │    │  └────────────────┘  │               │
│  └──────────────────────┘    └──────────────────────┘               │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        MEMORY SYSTEM                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │   │
│  │  │   Working   │  │    Long     │  │ Procedural  │           │   │
│  │  │   Memory    │  │    Term     │  │   Memory    │           │   │
│  │  │  (session)  │  │  (semantic) │  │  (how-to)   │           │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        TOOL SYSTEM                            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │   │
│  │  │  Shell  │ │  File   │ │   Git   │ │   Web   │ │ Plugins │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                         PROVIDER LAYER                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │Anthropic│ │ OpenAI  │ │ Ollama  │ │ Custom  │                    │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                    │
├──────────────────────────────────────────────────────────────────────┤
│                         PERSISTENCE LAYER                            │
│                     ┌─────────────────────┐                          │
│                     │       SQLite        │                          │
│                     │  (all agent state)  │                          │
│                     └─────────────────────┘                          │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Agent Core** | Runs the ReAct loop: Think → Act → Observe → Persist |
| **Heartbeat Daemon** | Background task scheduler, wake events, health checks |
| **Memory System** | Context management across sessions, knowledge persistence |
| **Tool System** | Capability plugins with sandboxed execution |
| **Policy Engine** | Safety enforcement, rate limiting, audit logging |
| **Provider Layer** | Abstract LLM interface, model routing |
| **Persistence Layer** | SQLite database for all agent state |

### 3.3 Process Lifecycle

```
        ┌──────────────┐
        │   STARTUP    │
        │  Load config │
        │  Init DB     │
        │  Load tools  │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐     ┌──────────────┐
        │   RUNNING    │◄────│  HEARTBEAT   │
        │  Agent loop  │     │  Background  │
        │  executing   │     │  tasks       │
        └──────┬───────┘     └──────────────┘
               │
               ▼
        ┌──────────────┐
        │   SLEEPING   │  ← Agent idle, heartbeat runs
        │  No active   │
        │  conversation│
        └──────┬───────┘
               │
               ▼ (wake event or schedule)
        ┌──────────────┐
        │   WAKEUP     │
        │  Resume loop │
        └──────────────┘
```

---

## 4. Core Components

### 4.1 Agent Core

The Agent Core implements the **ReAct pattern** (Reason + Act):

```
┌─────────────────────────────────────────────────────────────┐
│                      ReAct Loop                              │
│                                                              │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│   │  THINK   │───▶│   ACT    │───▶│ OBSERVE  │──┐           │
│   │          │    │          │    │          │  │           │
│   │ LLM call │    │ Tool     │    │ Parse    │  │           │
│   │ reasoning│    │ execution│    │ results  │  │           │
│   └──────────┘    └──────────┘    └──────────┘  │           │
│        ▲                                        │           │
│        │           ┌──────────┐                 │           │
│        └───────────│ PERSIST  │◄────────────────┘           │
│                    │          │                             │
│                    │ Memory   │                             │
│                    │ update   │                             │
│                    └──────────┘                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Behaviors:**
- Maximum 10 tool calls per turn (prevents runaway)
- Maximum 5 consecutive errors before escalation
- Repetitive turn detection (prevents loops)
- Token budget enforcement
- All tool calls gated by policy engine

### 4.2 Heartbeat Daemon

Background task scheduler with DB-backed persistence:

**Built-in Tasks:**
- `health_check` — Agent self-diagnostics
- `memory_consolidation` — Compress working memory to long-term
- `metric_snapshot` — Record performance metrics
- `stale_task_cleanup` — Clean abandoned tasks

**Features:**
- Cron expression support
- DB-backed schedule persistence
- Lease-based execution (prevents duplicates)
- Wake event generation

### 4.3 Memory System (3-Tier)

Simplified from Conway's 5-tier to focused 3-tier:

| Tier | Purpose | Lifetime | Token Budget |
|------|---------|----------|--------------|
| **Working** | Current session context, recent turns | Session | 8,000 |
| **Long-Term** | Semantic facts, relationships, opinions | Persistent | 4,000 |
| **Procedural** | How-to procedures, learned patterns | Persistent | 2,000 |

**Total context budget: 14,000 tokens**

### 4.4 Tool System

Plugin architecture with safety wrappers:

**Core Tools:**
| Category | Tools |
|----------|-------|
| Shell | exec, spawn |
| File | read, write, delete, list |
| Git | status, commit, push, pull |
| Web | fetch, search |
| Memory | recall, store, forget |
| Agent | spawn, message, status |

**Risk Levels:**
| Level | Examples | Auth Required |
|-------|----------|---------------|
| LOW | read_file, recall | None |
| MEDIUM | write_file, exec | Standard policy |
| HIGH | delete, git_push | Enhanced logging |
| CRITICAL | self_modify | Creator approval |

### 4.5 Policy Engine

**Code-level safety enforcement:**

**Rule Categories:**
1. **Authority Rules** — Who can do what
2. **Path Protection** — File system restrictions
3. **Rate Limits** — Action frequency caps
4. **Content Filters** — Injection detection, sensitive data

**Decision Outputs:**
- `ALLOW` — Proceed with execution
- `DENY` — Block, log, inform agent
- `ESCALATE` — Require human approval
- `QUARANTINE` — Allow but flag for review

### 4.6 Provider Layer

Abstract interface for LLM providers:

**Supported Providers:**
- Anthropic (Claude)
- OpenAI (GPT)
- Ollama (local)
- Custom (extensible)

**Model Router:**
- Task-type based routing
- Cost optimization
- Fallback chains

---

## 5. Data Flow

### 5.1 Agent Turn Flow

```
INPUT → Context Assembly → Token Budget Check → LLM Inference 
     → Tool Execution (via Policy) → Persistence → OUTPUT
```

### 5.2 Heartbeat Task Flow

```
Timer Tick → Check Due Tasks → Acquire Lease → Policy Check 
          → Execute Task → Update State → Wake Agent (if needed)
```

---

## 6. Integration Points

### 6.1 OpenClaw Integration

| OpenClaw Component | Castellan Integration |
|--------------------|----------------------|
| Gateway | Agents register for messaging |
| Skills | Use OpenClaw skills as tools |
| Memory | Shared format with workspace |
| Channels | Send via Discord, Telegram, etc. |
| Cron | Heartbeat triggers cron jobs |

### 6.2 External Services

- SSH (fleet management)
- Gmail (inbox agent)
- GitHub (repo operations)
- Discord (communications)

All credentials stored in encrypted vault with scoped access.

---

## 7. Deployment Model

### 7.1 Single-Agent

```
Host Machine
├── Castellan Process
│   ├── Agent Core
│   ├── Heartbeat Daemon
│   └── SQLite DB
└── Systemd Service (auto-restart, logging)
```

### 7.2 Multi-Agent (Future)

```
Host Machine
├── Kevin Prime (Orchestrator)
├── FleetGuard (specialist)
├── ContentEngine (specialist)
├── InboxAgent (specialist)
└── Shared Message Bus
```

---

## Next Documents

1. **COMPONENTS.md** — Detailed specification for each component
2. **DATABASE.md** — Schema design and migrations
3. **API.md** — Internal APIs between components
4. **SECURITY.md** — Threat model and mitigations
5. **IMPLEMENTATION-PLAN.md** — Phased build order

---

*Architecture by BigBrain — 2026-03-02*
*"A castle keeper serves the kingdom, not itself."*
