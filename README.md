# Agent UI

Desktop prototype for a Forge-backed chat client built with Tauri 2, React, Vite, and TypeScript.

## Package manager

This repo now uses Bun as the canonical JavaScript package manager.

## Prerequisites

- [Bun](https://bun.sh)
- Rust toolchain
- Tauri system dependencies for your platform

## Install

```bash
bun install
```

## Development

Frontend only:

```bash
bun run dev
```

Desktop app:

```bash
bun run tauri dev
```

## Verification

```bash
bun run test
bun run build
```
