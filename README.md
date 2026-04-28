# Cindra

Cindra is a desktop interface for running coding-agent workflows on top of [Forgecode](https://github.com/tailcallhq/forgecode), the #1 harness for agentic coding. It pairs a local Tauri shell with a React workspace UI for project chats, terminal output, and multi-conversation work.

## Status

Cindra is early software. Expect sharp edges while the app, packaging, and Forgecode integration settle.

## Stack

- Tauri 2 desktop shell
- React, Vite, and TypeScript frontend
- Rust command layer
- [Forgecode](https://github.com/tailcallhq/forgecode) vendored in `vendor/forgecode`
- Bun for JavaScript package management

## Prerequisites

- [Bun](https://bun.sh)
- Rust toolchain
- Tauri system dependencies for your platform

## Setup

```bash
bun install
```

## Development

Run the frontend in the browser:

```bash
bun run dev
```

Run the desktop app:

```bash
bun run tauri dev
```

## Verification

```bash
bun run test
bun run build
```

## License

Cindra is licensed under AGPL-3.0-or-later.

This project includes Forgecode under Apache-2.0 in `vendor/forgecode`.
