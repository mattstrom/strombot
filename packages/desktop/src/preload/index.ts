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
		create: (projectId) => ipcRenderer.invoke('threads:create', projectId),
		remove: (id) => ipcRenderer.invoke('threads:remove', id),
		rename: (id, title) => ipcRenderer.invoke('threads:rename', id, title),
		move: (id, projectId) => ipcRenderer.invoke('threads:move', id, projectId),
		messages: (id) => ipcRenderer.invoke('threads:messages', id),
	},
	projects: {
		list: () => ipcRenderer.invoke('projects:list'),
		create: (name) => ipcRenderer.invoke('projects:create', name),
		rename: (id, name) => ipcRenderer.invoke('projects:rename', id, name),
		remove: (id) => ipcRenderer.invoke('projects:remove', id),
	},
	settings: {
		get: () => ipcRenderer.invoke('settings:get'),
		update: (update) => ipcRenderer.invoke('settings:update', update),
	},
};

contextBridge.exposeInMainWorld('api', api);
