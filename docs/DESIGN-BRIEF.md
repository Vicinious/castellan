# Castellan Design Brief

**For:** BigBrain (Design Phase)
**From:** Kevin
**Date:** 2026-03-02
**Project:** Castellan Autonomous Agent Runtime

---

## Executive Summary

Design a clean-room autonomous agent runtime inspired by Conway's Automaton but stripped of crypto economics and vendor lock-in. Focus on persistent, self-improving agents that extend human reach.

---

## Reference Implementation

**Analyzed:** https://github.com/Conway-Research/automaton
**Local copy:** `/home/openclaw/.openclaw/workspace/projects/automaton-analysis/original-repo/`
**Analysis doc:** `/home/openclaw/.openclaw/workspace/projects/automaton-analysis/ANALYSIS.md`

---

## Core Requirements

### Must Have
1. **Agent Loop** — ReAct pattern (Think → Act → Observe → Persist)
2. **Heartbeat Daemon** — Background task scheduler, wake events
3. **Memory System** — Multi-tier, persistent across sessions
4. **Tool System** — Extensible, pluggable, sandboxed
5. **Policy Engine** — Safety rails, tool gating, rate limits
6. **State Persistence** — SQLite database for all agent state

### Should Have
1. **Self-Modification** — Agents can update their own config/tools (with safety)
2. **Agent Spawning** — Create specialist sub-agents
3. **Inter-Agent Communication** — Message passing between agents
4. **Observability** — Structured logging, metrics, alerts

### Won't Have (Initially)
1. Crypto wallets / USDC payments
2. Survival tiers / economic pressure
3. On-chain identity (ERC-8004)
4. Conway Cloud integration

---

## Architecture Constraints

1. **Provider Agnostic** — Must work with any LLM provider (Anthropic, OpenAI, Ollama)
2. **Self-Hosted** — Runs on our infrastructure, no external dependencies
3. **OpenClaw Compatible** — Integrates with existing OpenClaw ecosystem
4. **TypeScript** — Match existing codebase
5. **SQLite** — Simple, portable, no external DB required

---

## Safety Requirements

1. **Policy Engine** — Every tool call goes through policy evaluation
2. **Protected Paths** — Certain files/directories cannot be modified
3. **Rate Limits** — Prevent runaway loops
4. **Audit Log** — Every action logged immutably
5. **Kill Switch** — Ability to halt agent remotely
6. **Human Escalation** — Clear path to involve human when uncertain

---

## Target Agents (Inform Design)

| Agent | Domain | Key Capabilities |
|-------|--------|------------------|
| FleetGuard | Servers | SSH, monitoring, remediation |
| ContentEngine | Content | CMS integration, image gen, publishing |
| InboxAgent | Email | Gmail API, triage, drafting |
| ProjectTracker | Projects | File system, git, task tracking |
| ResearchBot | Research | Web search, scraping, summarization |

Design should accommodate all these use cases.

---

## Deliverables

1. **ARCHITECTURE.md** — System overview, component diagram, data flow
2. **COMPONENTS.md** — Detailed spec for each major component
3. **DATABASE.md** — Schema design, migrations
4. **API.md** — Internal APIs between components
5. **SECURITY.md** — Threat model, mitigations
6. **IMPLEMENTATION-PLAN.md** — Phased build order, dependencies

---

## Timeline

Design phase: 24-48 hours
Review: Kevin reviews, Anthony approves
Implementation: Follows SDLC pipeline

---

## Notes

- Study the Automaton codebase but don't copy code — clean-room implementation
- Focus on simplicity over features initially
- Build for extensibility — we'll add capabilities over time
- Remember: These agents serve Anthony's kingdom, not their own survival

---

*Brief prepared by Kevin, Hand of the King 🦉*
