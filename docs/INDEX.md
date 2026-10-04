# Documentation Index

> Quick Chat — Engineering documentation for the real-time messaging platform.

[← Back to README](../README.md)

## Overview

| Document | What It Covers |
|----------|---------------|
| [Architecture](ARCHITECTURE.md) | High-level system design, component relationships, data flow |
| [System Design](SYSTEM_DESIGN.md) | Authentication, message lifecycle, caching, offline-first design |
| [Message Flow](MESSAGE_FLOW.md) | End-to-end message delivery with sequence diagrams |
| [Engineering Decisions](ENGINEERING_DECISIONS.md) | Technology tradeoffs and rationale |
| [API Reference](API.md) | REST endpoints and WebSocket events |
| [Deployment](DEPLOYMENT.md) | Environment variables, Docker, production setup |
| [Performance](PERFORMANCE.md) | Caching, virtualization, latency, scalability |
| [Performance Engineering](PERFORMANCE_ENGINEERING.md) | Advanced concepts from the realtime-market-lab: reconnect resilience, instrumentation, fanout hot spots, rollout order |
| [Performance Implementation](PERFORMANCE_IMPLEMENTATION.md) | What shipped phase by phase: commits, verification, rollback |
| [Security](SECURITY.md) | JWT, validation, rate limiting, attack prevention |

## Component Documentation

| Document | What It Covers |
|----------|---------------|
| [Client README](../client/README.md) | Frontend architecture, hooks, state management, components |
| [Server README](../server/README.md) | Backend modules, database, Socket.io, services, middleware |

## Quick Navigation

- **New to the project?** Start with [Architecture](ARCHITECTURE.md)
- **Evaluating the backend?** Read [Server README](../server/README.md) then [API Reference](API.md)
- **Evaluating the frontend?** Read [Client README](../client/README.md) then [Message Flow](MESSAGE_FLOW.md)
- **Deploying?** See [Deployment](DEPLOYMENT.md)
- **Interview prep?** Review [Engineering Decisions](ENGINEERING_DECISIONS.md) and [Performance](PERFORMANCE.md)
