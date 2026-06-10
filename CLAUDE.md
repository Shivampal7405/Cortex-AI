# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run type-check          # TypeScript strict check — must pass before any commit
npm run build:chrome        # Full Chrome build → dist/chrome/
npm run build:firefox       # Full Firefox build → dist/firefox/
npm run dev                 # Watch mode (Vite only — does not rebuild content scripts)
npm run lint                # ESLint
```

There are no automated tests. Verification is manual: load `dist/chrome/` as an unpacked extension in Chrome DevTools.

To load the extension: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `dist/chrome/`.

## Dual Build System

**Two bundlers run sequentially in `scripts/build.ts`:**

1. **Vite** — builds the popup UI and options page into `dist/{target}/popup/` and `dist/{target}/options/`. Config in `vite.config.ts`.

2. **esbuild** — bundles background service worker and all content/injected/tracker scripts into `dist/{target}/`. Each file in `src/agents/{agent}/` is a separate esbuild entry point (IIFE, no shared chunks).

Tailwind CSS for the Shadow DOM token bar is built separately via `npx tailwindcss` into `dist/{target}/content.css`.

Two manifest files exist: `manifests/manifest.chrome.json` (MV3) and `manifests/manifest.firefox.json` (MV2). The build copies the correct one to `dist/{target}/manifest.json`.

## Script Context Architecture

This is the most important architectural concept. Four execution contexts exist with **completely different capabilities**:

| Context | Origin | DOM | chrome.* | IndexedDB | window.fetch patch |
|---|---|---|---|---|---|
| **Popup / Options** | `chrome-extension://` | extension page | full | extension origin | no |
| **Background worker** | `chrome-extension://` | none | full | extension origin | no |
| **Content script** | page origin (`claude.ai`, etc.) | yes | limited | **PAGE origin** | isolated world |
| **Injected script** (`*.injected.ts`) | page origin | yes | none | page origin | yes — MAIN world |

**Critical constraint**: Content scripts use the **page's** IndexedDB (e.g. `https://claude.ai`), not the extension's. The popup uses the extension-origin IndexedDB. These are completely separate storage partitions. All shared state must go through `chrome.storage.local`, not IndexedDB.

Content scripts cannot set the `Cookie` header in `fetch()` — it is a forbidden header. Use `credentials: 'include'` instead when fetching from a page-origin content script context.

## Agent File Pattern

Each AI provider (`claude`, `chatgpt`, `gemini`, `grok`) may have up to four files:

- **`{agent}.content.ts`** — content script injected by the manifest. For Claude: mounts the token bar, polls `/usage`, intercepts SSE. For others: mounts token bar UI.
- **`{agent}.injected.ts`** — injected into the MAIN world (via `chrome.scripting.executeScript` from the content script). Used only where `window.fetch` must be patched to intercept streaming responses.
- **`{agent}.tracker.ts`** — invisible content script. Saves conversation IDs and history to `chrome.storage.local`. No UI. Runs at `document_idle`.
- **`{agent}.poller.ts`** — runs in the **background** service worker (imported by `background.ts`). Polls provider APIs via `chrome.alarms`. No DOM access.

## Data Flow for Token Bar

```
claude.injected.ts (MAIN world)
  → patches window.fetch, intercepts SSE message_limit events
  → postMessage to content script

claude.content.ts (content script)
  → polls /api/organizations/{orgId}/usage every 30s
  → receives SSE data from injected script
  → chrome.runtime.sendMessage({ type: 'USAGE_UPDATE' })

background/message.router.ts
  → handles USAGE_UPDATE → calls handleUsageUpdate()

background/usage.aggregator.ts
  → writes provider:{claude} to chrome.storage.local
  → writes tokenBarState:claude to chrome.storage.local
  → chrome.tabs.sendMessage({ type: 'TOKEN_BAR_UPDATE' }) to all claude.ai tabs

content-ui/token-bar/TokenBar.tsx
  → listens for TOKEN_BAR_UPDATE, updates React state
```

The token bar is mounted inside a **Shadow DOM** (see `content-ui/shared/mount.ts`) to isolate Tailwind styles from the host page. CSS is fetched from `chrome.runtime.getURL('content.css')` at mount time.

## Storage Keys

All cross-context state lives in `chrome.storage.local`:

| Key | Written by | Read by |
|---|---|---|
| `provider:{claude\|chatgpt\|gemini\|grok}` | background aggregator / pollers | popup OverviewView |
| `tokenBarState:{provider}` | background aggregator | TokenBar content script |
| `claude_org_id`, `claude_conv_id` | claude.content.ts | background (TRANSFER_CONTEXT) |
| `{provider}_conv_id` | tracker content scripts | conversation.fetcher.ts |
| `{provider}_conv_history` | tracker content scripts | conversation.fetcher.ts |

## Memory Layer (Phase 4A)

Facts are extracted from user messages by `memory.watcher.ts` (runs inside claude.content.ts) and stored via `memory.store.ts` (IndexedDB). **Both run in the content script context** (page origin). The popup's `MemoryView` reads from `memory.store.ts` but runs in the **extension origin** — a different IndexedDB partition. To share facts between contexts, use `chrome.storage.local` instead of or in addition to IndexedDB.

## Code Constraints

- **200-line file limit** — enforced by phase checklists. Split files if approaching the limit.
- **No `any` types** — use union types with explicit casts (`as ClaudeUsage`) inside provider-specific branches.
- **Header comment on every file** — one `/** ... */` block at the top describing the file's role.
- **No external state management library** — state is plain React `useState` + `chrome.storage.local`.
