import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { app, safeStorage } from 'electron';

import { DEFAULT_MODEL, type Settings, type UpdateSettings } from '../shared/types';

interface StoredSettings {
	model: string;
	apiKey?: {
		value: string;
		encrypted: boolean;
	};
}

function settingsPath(): string {
	return join(app.getPath('userData'), 'settings.json');
}

function readStored(): StoredSettings {
	try {
		return JSON.parse(readFileSync(settingsPath(), 'utf8')) as StoredSettings;
	} catch {
		return { model: DEFAULT_MODEL };
	}
}

function writeStored(stored: StoredSettings): void {
	writeFileSync(settingsPath(), JSON.stringify(stored, null, 2));
}

export function getApiKey(): string | undefined {
	const stored = readStored();
	if (!stored.apiKey) {
		return undefined;
	}
	if (stored.apiKey.encrypted) {
		return safeStorage.decryptString(Buffer.from(stored.apiKey.value, 'base64'));
	}

	return stored.apiKey.value;
}

export function getSettings(): Settings {
	const stored = readStored();

	return {
		model: stored.model || DEFAULT_MODEL,
		hasApiKey: Boolean(stored.apiKey),
	};
}

export function updateSettings(update: UpdateSettings): Settings {
	const stored = readStored();
	if (update.model) {
		stored.model = update.model;
	}
	if (update.apiKey !== undefined) {
		if (update.apiKey === '') {
			delete stored.apiKey;
		} else if (safeStorage.isEncryptionAvailable()) {
			stored.apiKey = {
				value: safeStorage.encryptString(update.apiKey).toString('base64'),
				encrypted: true,
			};
		} else {
			stored.apiKey = { value: update.apiKey, encrypted: false };
		}
	}
	writeStored(stored);

	return getSettings();
}
