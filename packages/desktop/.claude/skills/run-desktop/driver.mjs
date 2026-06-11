// REPL driver for the Strombot desktop app (Playwright _electron).
// Agent tooling: pipe commands via a FIFO or tmux; see SKILL.md.
//
// Launches the BUILT app (run `npm run build` in packages/desktop first)
// through a generated wrapper that points userData at an isolated /tmp
// dir, so driving the app never touches the real chat database.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as readline from 'node:readline';

import { _electron as electron } from 'playwright-core';

const APP_DIR = path.resolve(import.meta.dirname, '../../..'); // packages/desktop
const REPO_ROOT = path.resolve(APP_DIR, '../..');
const WORK_DIR = process.env.DRIVER_WORK_DIR || path.join(os.tmpdir(), 'strombot-driver');
const USER_DATA = path.join(WORK_DIR, 'userdata');
const WRAPPER = path.join(WORK_DIR, 'app');
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';

const ELECTRON_BIN =
	process.platform === 'darwin'
		? path.join(REPO_ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
		: path.join(REPO_ROOT, 'node_modules/electron/dist/electron');

function prepareWorkDir() {
	fs.mkdirSync(SHOT_DIR, { recursive: true });
	fs.mkdirSync(USER_DATA, { recursive: true });
	fs.mkdirSync(WRAPPER, { recursive: true });
	fs.writeFileSync(
		path.join(WRAPPER, 'package.json'),
		JSON.stringify({
			name: 'strombot-driver',
			version: '1.0.0',
			type: 'module',
			main: 'index.mjs',
		}),
	);
	fs.writeFileSync(
		path.join(WRAPPER, 'index.mjs'),
		`import { app } from 'electron';\n` +
			`app.setPath('userData', ${JSON.stringify(USER_DATA)});\n` +
			`await import(${JSON.stringify(path.join(APP_DIR, 'out/main/index.js'))});\n`,
	);
	// Fake API key: chat requests reach Mastra (threads persist) but the LLM
	// call fails with "invalid x-api-key" — full UI flows without spending money.
	const settings = path.join(USER_DATA, 'settings.json');
	if (!fs.existsSync(settings)) {
		fs.writeFileSync(
			settings,
			JSON.stringify({
				model: 'claude-sonnet-4-6',
				apiKey: { value: 'sk-ant-fake-key-for-ui-verification', encrypted: false },
			}),
		);
	}
}

let app = null;
let page = null;

const COMMANDS = {
	async launch() {
		if (app) return console.log('already launched');
		if (!fs.existsSync(path.join(APP_DIR, 'out/main/index.js'))) {
			return console.log(
				'ERROR: out/main/index.js missing — run `npm run build` in packages/desktop first',
			);
		}
		prepareWorkDir();
		app = await electron.launch({
			executablePath: ELECTRON_BIN,
			args: ['--no-sandbox', WRAPPER],
			timeout: 30_000,
		});
		page = await app.firstWindow();
		await page.waitForSelector('aside', { timeout: 15_000 });
		console.log('launched.', app.windows().length, 'windows. userData:', USER_DATA);
	},

	async ss(name) {
		if (!page) return console.log('ERROR: launch first');
		const f = path.join(SHOT_DIR, `${name || `ss-${Date.now()}`}.png`);
		await page.screenshot({ path: f });
		console.log('screenshot:', f);
	},

	// DOM click — fine for plain buttons, does NOT open Radix dropdown menus.
	async click(sel) {
		if (!page) return console.log('ERROR: launch first');
		const r = await page.evaluate((s) => {
			const el = document.querySelector(s);
			if (!el) return 'NOT_FOUND';
			el.click();
			return 'OK';
		}, sel);
		console.log('click', sel, '→', r);
	},

	async 'click-text'(text) {
		if (!page) return console.log('ERROR: launch first');
		const r = await page.evaluate((t) => {
			const els = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]')];
			const el =
				els.find((e) => e.textContent?.trim() === t) ?? els.find((e) => e.textContent?.includes(t));
			if (!el) return 'NOT_FOUND';
			el.click();
			return 'OK: ' + el.tagName;
		}, text);
		console.log('click-text', JSON.stringify(text), '→', r);
	},

	// Real pointer click via Playwright locator (supports `:has-text()`, `>> nth=`).
	// Required for Radix dropdown triggers and menu items.
	async ptr(sel) {
		if (!page) return console.log('ERROR: launch first');
		try {
			await page.locator(sel).first().click({ timeout: 5000 });
			console.log('ptr', sel, '→ OK');
		} catch (e) {
			console.log('ptr', sel, '→ ERROR:', e.message.split('\n')[0]);
		}
	},

	async hover(sel) {
		if (!page) return console.log('ERROR: launch first');
		try {
			await page.locator(sel).first().hover({ timeout: 5000 });
			console.log('hover', sel, '→ OK');
		} catch (e) {
			console.log('hover', sel, '→ ERROR:', e.message.split('\n')[0]);
		}
	},

	async type(text) {
		if (page) await page.keyboard.type(text, { delay: 20 });
		console.log('typed');
	},
	async press(key) {
		if (page) await page.keyboard.press(key);
		console.log('pressed', key);
	},

	async eval(expr) {
		if (!page) return console.log('ERROR: launch first');
		try {
			console.log(JSON.stringify(await page.evaluate(expr)));
		} catch (e) {
			console.log('ERROR:', e.message.split('\n')[0]);
		}
	},

	async text(sel) {
		if (!page) return console.log('ERROR: launch first');
		console.log(
			await page.evaluate(
				(s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
				sel || null,
			),
		);
	},

	async quit() {
		if (app) await app.close().catch(() => {});
		app = null;
		page = null;
	},
	help() {
		console.log('commands:', Object.keys(COMMANDS).join(', '));
	},
};

// Raw fd read keeps Electron from stealing stdin (also makes FIFO input work).
const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async (line) => {
	const [cmd, ...rest] = line.trim().split(/\s+/);
	if (!cmd) return rl.prompt();
	const fn = COMMANDS[cmd];
	if (!fn) {
		console.log('unknown:', cmd, '— try: help');
		return rl.prompt();
	}
	try {
		await fn(rest.join(' '));
	} catch (e) {
		console.log('ERROR:', e.message.split('\n')[0]);
	}
	if (cmd === 'quit') {
		rl.close();
		process.exit(0);
	}
	rl.prompt();
});
rl.on('close', async () => {
	await COMMANDS.quit();
	process.exit(0);
});

console.log('strombot driver — "help" for commands, "launch" to start');
rl.prompt();
