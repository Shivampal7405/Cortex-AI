# Cortex - AI Co-Pilot

A Chrome / Firefox browser extension that tracks AI token usage, switches models,
compares answers across LLMs, and carries a shared memory across **Claude, ChatGPT,
Gemini, and Grok**.

- **Live token bar** on claude.ai - 5-hour rate-limit and context-window usage.
- **Cross-LLM Compare** - send the same prompt to another model from any provider
  and watch both answers stream side-by-side.
- **Shared memory** - pin facts/projects once and inject them into any AI's input.
- **Context transfer** - move a conversation's history from one provider to another.
- **52-week activity heatmap** - per-provider usage history.
- **Prompt library** and **budget alerts**.

> Privacy: API keys and conversation data are stored **locally** in
> `chrome.storage.local` only. Nothing is synced or sent to any Cortex server.

---

## Install from Git

### Prerequisites
- [Node.js](https://nodejs.org/) **18+** (tested on 24) and npm
- Google Chrome / Chromium, or Firefox

### 1. Clone the repository
```bash
git clone https://github.com/Shivampal7405/Cortex-AI.git
cd Cortex-AI
```

### 2. Install dependencies
```bash
npm install
```

### 3. Build the extension
```bash
# Chrome / Edge / Brave (Manifest V3)
npm run build:chrome      # -> dist/chrome/

# Firefox (Manifest V2)
npm run build:firefox     # -> dist/firefox/
```

### 4. Load the unpacked extension

**Chrome / Edge / Brave**
1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `dist/chrome/` folder

**Firefox**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist/firefox/manifest.json`

After loading, open Claude/ChatGPT/Gemini/Grok and you will see the token bar
(Claude) and the floating **Compare** button.

---

## Optional: enable smart memory extraction

Memory facts use a regex fallback by default. For higher-quality extraction, add a
free API key in the extension's **Settings** page (right-click the toolbar icon ->
*Options*):

| Provider | Key prefix | Free tier |
|----------|-----------|-----------|
| **Groq** (recommended) | `gsk_...` | yes - Llama 3.3 70B |
| OpenAI | `sk-...` | - |
| Gemini | `AIza...` | yes |
| **NVIDIA NIM** | `nvapi-...` | yes - Llama 3.1 8B |

Keys are validated and stored locally only.

---

## Development

```bash
npm run type-check      # TypeScript strict check (must pass before commit)
npm run build:chrome    # full Chrome build
npm run build:firefox   # full Firefox build
npm run lint            # ESLint
```

There are no automated tests - verification is manual via the unpacked extension in
DevTools.

### Build system
Two bundlers run sequentially in `scripts/build.ts`:
1. **Vite** builds the popup + options UI.
2. **esbuild** bundles the background worker and all content/injected/tracker
   scripts (one IIFE per entry).

Tailwind for the Shadow-DOM token bar is compiled separately to
`dist/{target}/content.css`. The correct manifest is copied to
`dist/{target}/manifest.json`.

### Project layout
```
src/
  agents/{claude,chatgpt,gemini,grok}/   provider content/tracker scripts
  agents/shared/                          shared tracker helpers (activity)
  background/                             service worker, routing, aggregation
  content-ui/
    token-bar/                            Claude token bar (Shadow DOM)
    compare-overlay/                      cross-LLM compare overlay + launcher
  memory/                                 facts, projects, extraction, transfer
  popup/  options/  shared/
```

---

## License

Personal project - all rights reserved unless stated otherwise.