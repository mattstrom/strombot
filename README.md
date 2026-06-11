# Strombot

Custom chat client for all the features that I wish the other chat apps had

## Stack

- **Desktop shell**: Electron + electron-vite (`packages/desktop`)
- **LLM layer**: Mastra agent in the main process, with `@mastra/memory` + LibSQL for conversation persistence (stored in the app's `userData` directory)
- **Frontend**: React 19, business logic in MobX stores (`src/renderer/src/stores`), shadcn/ui + Tailwind v4 for components

## Development

```sh
npm install
npm run dev
```

On first launch, open Settings and paste an Anthropic API key (stored encrypted via Electron `safeStorage`).

## Architecture notes

- The renderer never touches the network or filesystem; everything goes through the typed `window.api` bridge (`src/shared/api.ts`) to IPC handlers in `src/main/ipc.ts`.
- Conversations are Mastra memory threads. New threads are materialized lazily on the first message so Mastra's automatic title generation (which only runs for untitled threads) kicks in.
- Streaming responses flow main → renderer as `chat:chunk` events keyed by request id; `ChatStore` accumulates them.
