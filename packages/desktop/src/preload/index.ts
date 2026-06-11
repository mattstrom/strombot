import { contextBridge, ipcRenderer } from 'electron';

import type { StrombotApi } from '../shared/api';
import type { ChatChunk } from '../shared/types';

const api: StrombotApi = {
	chat: {
		send: (request) => ipcRenderer.invoke('chat:send', request),
		abort: (requestId) => ipcRenderer.invoke('chat:abort', requestId),
		onChunk: (callback) => {
			const listener = (_event: Electron.IpcRendererEvent, chunk: ChatChunk): void => {
				callback(chunk);
			};
			ipcRenderer.on('chat:chunk', listener);

			return () => {
				ipcRenderer.removeListener('chat:chunk', listener);
			};
		},
	},
	threads: {
		list: () => ipcRenderer.invoke('threads:list'),
		create: () => ipcRenderer.invoke('threads:create'),
		remove: (id) => ipcRenderer.invoke('threads:remove', id),
		rename: (id, title) => ipcRenderer.invoke('threads:rename', id, title),
		messages: (id) => ipcRenderer.invoke('threads:messages', id),
	},
	settings: {
		get: () => ipcRenderer.invoke('settings:get'),
		update: (update) => ipcRenderer.invoke('settings:update', update),
	},
};

contextBridge.exposeInMainWorld('api', api);
