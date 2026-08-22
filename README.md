# studiochat

studiochat is a macOS desktop chat and control surface for Logic Pro and the
Plecat Mood single/album creation process. It connects to the locally
installed `LogicProMCP` server over stdio and uses the local Codex chat flow to
turn natural-language requests into Logic Pro actions, creative direction,
lyrics, visual briefs, and release plans.

## Features

- Chat with an assistant that can inspect and control the open Logic Pro session
- Built-in Plecat Mood creative operating system covering the era thesis,
  storyline, visual language, content system, and 90-day rollout
- One-click creative flows for singles, albums, lyrics, visuals, and rollout
- Automatic connection to the local LogicProMCP server
- Live connection status and quick transport controls
- Access to every MCP tool exposed by LogicProMCP
- Confirmation dialogs for higher-risk actions
- Conversation continuity through `previous_response_id`
- API key storage protected by Electron `safeStorage` and the macOS Keychain
- Dark native macOS interface

## Requirements

- macOS with Logic Pro installed
- Node.js 20 or newer
- LogicProMCP installed at `/opt/homebrew/bin/LogicProMCP`
- Accessibility and Automation permissions for LogicProMCP
- An OpenAI API key

Logic Pro should be open with a project loaded before connecting studiochat.

## Getting started

```bash
npm install
npm run check
npm test
npm run dev
```

On first launch, open Settings and save an OpenAI API key. The key is stored
locally using macOS-backed secure storage and is not written as plaintext to
the project or application files.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Launch the Electron app in development mode |
| `npm run check` | Syntax-check the main, service, preload, and renderer files |
| `npm test` | Run the Node test suite |
| `npm run build` | Build an unsigned macOS app bundle |
| `npm run dist` | Build an unsigned macOS DMG |

## Architecture

- `src/main.js` — Electron main process, window lifecycle, IPC, and approvals
- `src/logic-service.js` — LogicProMCP stdio client and tool execution
- `src/openai-service.js` — Responses API conversation and tool loop
- `src/codex-service.js` — local Codex conversation with Plecat Mood context
- `src/plecat-context.js` — canonical Plecat Mood creative brief bundled into
  the app
- `src/settings-store.js` — local settings and secure API-key storage
- `src/core.js` — tool conversion, result formatting, and approval rules
- `src/preload.cjs` — restricted renderer bridge
- `renderer/` — the desktop chat interface

The renderer does not receive direct Node.js access. It communicates with the
main process through the preload bridge, while the main process owns the MCP
connection, OpenAI client, and approval flow.

## Packaging

```bash
npm run build  # local unsigned .app
npm run dist   # local unsigned .dmg
```

Public distribution requires Apple Developer ID signing, hardened runtime
configuration, notarization, and a review of the LogicProMCP licensing and
redistribution terms. This project expects the LogicProMCP binary to be
installed separately.

## Security notes

studiochat keeps the OpenAI API key in Electron secure storage and does not
include it in source control. Higher-risk Logic actions require explicit user
approval before they are sent to LogicProMCP. Never commit credentials or
local build artifacts.
