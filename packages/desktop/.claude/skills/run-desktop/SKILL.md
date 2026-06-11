---
name: run-desktop
description: Build, run, and drive the Strombot Electron desktop app. Use when asked to start or run the desktop app, take a screenshot of its UI, verify a UI change in the real app, or interact with the running app programmatically.
---

Strombot desktop is an Electron app (electron-vite, React renderer). For
agent use, drive the **built** app via the Playwright REPL at
`.claude/skills/run-desktop/driver.mjs` — it launches Electron through a
generated wrapper that points `userData` at an isolated temp dir, so
driving it never touches the real chat database. Verified on macOS; on
headless Linux you would additionally need xvfb (untested here).

All paths below are relative to `packages/desktop/`.

## Setup

`playwright-core` is not a project dependency; install it without
touching the manifests (from the repo root):

```bash
npm i --no-save playwright-core
```

## Build

The driver launches `out/main/index.js`, so build first:

```bash
npm run build
```

## Run (agent path)

The driver is a stdin REPL. Without tmux (not installed on this
machine), drive it through a FIFO held open by a `sleep`:

```bash
rm -f /tmp/sv-cmd /tmp/sv-log; mkfifo /tmp/sv-cmd
sleep 3600 > /tmp/sv-cmd &
node .claude/skills/run-desktop/driver.mjs < /tmp/sv-cmd > /tmp/sv-log 2>&1 &

echo launch > /tmp/sv-cmd
for i in $(seq 1 80); do grep -Eq "launched\.|ERROR" /tmp/sv-log && break; sleep 0.5; done
echo 'ss landing' > /tmp/sv-cmd; sleep 2
tail -5 /tmp/sv-log
```

Screenshots → `/tmp/shots/` (override: `SCREENSHOT_DIR`). Isolated
app data → `$TMPDIR/strombot-driver/userdata` (override the work dir:
`DRIVER_WORK_DIR`); delete that dir for a fresh-profile run. When done:
`echo quit > /tmp/sv-cmd` and kill the `sleep` holding the FIFO.

| command                             | what it does                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `launch`                            | build wrapper + isolated userData, launch app, wait for sidebar               |
| `ss [name]`                         | screenshot → `/tmp/shots/<name>.png`                                          |
| `ptr <selector>`                    | real pointer click via Playwright locator (supports `:has-text()`, `>> nth=`) |
| `hover <selector>`                  | hover a locator                                                               |
| `click <css>` / `click-text <text>` | DOM `.click()` — plain buttons only, see Gotchas                              |
| `type <text>` / `press <key>`       | keyboard input (`press Meta+A`, `press Enter`, `press Escape`)                |
| `eval <js>`                         | evaluate in the renderer, print JSON — e.g. `eval window.api.threads.list()`  |
| `text [css]`                        | print innerText                                                               |
| `quit`                              | close app and exit the REPL                                                   |

`window.api` (the preload bridge) is reachable from `eval`, which is the
fastest way to assert persisted state: `eval window.api.projects.list()`,
`eval window.api.threads.list()`.

## Run (human path)

```bash
npm run dev   # electron-vite dev — opens a window. Ctrl-C to quit.
```

## Test

```bash
npm run test:ci   # currently exits 1: "No test files found" — no tests exist yet
```

## Gotchas

- **Radix dropdown menus ignore DOM `.click()`** — the trigger listens
  for real pointer events → use `ptr`, not `click`/`click-text`, for the
  "..." menus, menu items, and submenu triggers. Clicking a submenu
  trigger (e.g. "Move to project") with `ptr` opens the submenu; then
  `ptr` the item.
- **Ambiguous `:has-text()` matches** — `ptr` clicks the first match.
  Sidebar rows contain two buttons (title, then "..." menu): target the
  menu with `ptr aside .group:has-text("…") >> button >> nth=1`, and a
  specific row with `>> nth=N` after the row selector.
- **The window opens visibly on macOS** — the human at the machine can
  (and may) interact with it while you drive. Don't assume UI state you
  didn't just observe; re-screenshot before acting.
- **Seeded fake API key** — the driver writes a fake Anthropic key into
  the isolated settings. Sending a chat shows "invalid x-api-key", but
  Mastra persists the thread (with metadata) before the LLM call fails —
  full persistence flows verifiable at zero cost. For real chat, put a
  real key in `$TMPDIR/strombot-driver/userdata/settings.json`
  (`apiKey: { value, encrypted: false }`).
- **No `timeout` command on macOS** — poll with
  `for i in $(seq 1 N); do grep -q … && break; sleep 0.5; done`.

## Troubleshooting

- **`ERROR: out/main/index.js missing`**: you didn't build → `npm run build`.
- **`Cannot find package 'playwright-core'`**: run the Setup step at the
  repo root (`--no-save` keeps manifests clean).
- **`ptr … Timeout 5000ms exceeded`** on a menu item: the menu/submenu
  isn't open (a stray click closed it) → `press Escape`, reopen with
  `ptr`, then retry.
- **FIFO commands appear to run out of order**: each REPL command is
  awaited, but your `echo`s race ahead — put a `sleep` between sends and
  re-`tail` the log to confirm sequencing.
