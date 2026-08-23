# Architecture Guide

<!-- System boundaries and data flow. Not an API listing - describe what the
     pieces are, how they talk, and which boundaries must not be crossed
     casually. If the project cannot build an executable, say so here. -->

## Components

| Component | Path | Responsibility |
| --- | --- | --- |
| <name> | `src/...` | <what it owns> |

## Data flow

<how a request/action moves through the components>

## Boundaries

- <boundary and the contract that crosses it>

## Build output

<what `scripts/build.*` produces, or why the project has no executable build>
