import { join } from 'node:path';

import { app, BrowserWindow, shell } from 'electron';

import { registerIpc } from './ipc';

function createWindow(): BrowserWindow {
	const window = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 760,
		minHeight: 480,
		show: false,
		titleBarStyle: 'hiddenInset',
		trafficLightPosition: { x: 16, y: 14 },
		webPreferences: {
			preload: join(import.meta.dirname, '../preload/index.mjs'),
			sandbox: false,
		},
	});

	window.on('ready-to-show', () => window.show());

	window.webContents.setWindowOpenHandler(({ url }) => {
		void shell.openExternal(url);

		return { action: 'deny' };
	});

	if (process.env.ELECTRON_RENDERER_URL) {
		void window.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		void window.loadFile(join(import.meta.dirname, '../renderer/index.html'));
	}

	return window;
}

void app.whenReady().then(() => {
	registerIpc();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
