# Castellan Use Cases

*Saved from initial planning session — 2026-03-02*

---

## Use Case 1: Kevin Prime + Specialist Spawns

```
                    Anthony
                       │
                    Kevin (Prime)
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ContentBot     FleetBot      ResearchBot
   (anthonybahn)  (servers)     (projects)
```

- **Kevin** stays the generalist, orchestrator, Hand of the King
- **Spawns specialists** for long-running domains
- Each specialist has its own memory, context, goals
- Kevin monitors, coordinates, escalates to Anthony

---

## Use Case 2: True 24/7 Autonomous Operations

Not "cron job runs script" — **intelligent persistent agents:**

| Agent | Domain | Behavior |
|-------|--------|----------|
| FleetGuard | Server fleet | Monitors, heals, predicts, escalates |
| ContentEngine | anthonybahn.com | Writes, publishes, optimizes, reports |
| InboxAgent | Email/comms | Triages, drafts, follows up |
| ProjectTracker | Active projects | Tracks progress, nudges, summarizes |

Each runs continuously. Each remembers everything. Each acts without prompting.

---

## Use Case 3: Self-Improving Tooling

Agents that **evolve their own capabilities:**

- "I noticed I keep doing X manually, I'll write a script for it"
- "This tool is slow, I'll optimize it"
- "New pattern detected, adding to my procedures"

The heartbeat daemon + self-mod system enables this. Agents get better over time without touching them.

---

## Use Case 4: Project Persistence

**Problem now:** Session ends, context lost, next session starts cold.

**With this:** Assign an agent to a project. It persists until the project is done. Full memory, full context, picks up exactly where it left off.

- "GridStrike Agent" — knows everything about the game project
- "YouTube Agent" — knows channel, content plan, analytics
- "FBA Agent" — tracks suppliers, samples, timelines

---

## Use Case 5: Research & Intelligence

Long-running research that **accumulates knowledge:**

- "Watch these 5 competitors and summarize changes weekly"
- "Track AI news and surface only what matters to me"
- "Monitor this GitHub repo and alert on significant commits"

Not one-shot searches. Persistent awareness.

---

## Priority Order

1. **Core Runtime** — The foundation everything else needs
2. **FleetGuard** — Immediate value, server monitoring
3. **ContentEngine** — anthonybahn.com automation
4. **ProjectTracker** — Cross-project awareness
5. **InboxAgent** — Email automation
6. **ResearchBot** — Intelligence gathering

---

## What We Keep vs Drop from Automaton

| Keep | Drop |
|------|------|
| Agent loop (ReAct) | Crypto wallet |
| Heartbeat daemon | USDC payments |
| Memory system | Conway Cloud lock-in |
| Tool system | Survival tiers |
| Self-modification | Replication (initially) |
| Policy engine | ERC-8004 registry |

---

*Documented by Kevin, 2026-03-02*
