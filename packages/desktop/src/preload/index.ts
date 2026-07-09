import { contextBridge, ipcRenderer, webUtils } from 'electron';

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
		setPinned: (id, pinned) => ipcRenderer.invoke('threads:setPinned', id, pinned),
		messages: (id) => ipcRenderer.invoke('threads:messages', id),
	},
	branches: {
		list: (rootThreadId) => ipcRenderer.invoke('branches:list', rootThreadId),
		create: (request) => ipcRenderer.invoke('branches:create', request),
	},
	projects: {
		list: () => ipcRenderer.invoke('projects:list'),
		create: (name) => ipcRenderer.invoke('projects:create', name),
		rename: (id, name) => ipcRenderer.invoke('projects:rename', id, name),
		update: (id, update) => ipcRenderer.invoke('projects:update', id, update),
		remove: (id) => ipcRenderer.invoke('projects:remove', id),
		getMemory: (id) => ipcRenderer.invoke('projects:memory:get', id),
		setMemory: (id, content) => ipcRenderer.invoke('projects:memory:set', id, content),
		listFiles: (id) => ipcRenderer.invoke('projects:files:list', id),
		addFiles: (id, paths) => ipcRenderer.invoke('projects:files:add', id, paths),
		addFilesViaDialog: (id) => ipcRenderer.invoke('projects:files:addViaDialog', id),
		removeFile: (id, relPath) => ipcRenderer.invoke('projects:files:remove', id, relPath),
		revealFile: (id, relPath) => ipcRenderer.invoke('projects:files:reveal', id, relPath),
		linkWorkspace: (id) => ipcRenderer.invoke('projects:workspace:link', id),
		unlinkWorkspace: (id) => ipcRenderer.invoke('projects:workspace:unlink', id),
	},
	files: {
		getPathForFile: (file) => webUtils.getPathForFile(file),
	},
	settings: {
		get: () => ipcRenderer.invoke('settings:get'),
		update: (update) => ipcRenderer.invoke('settings:update', update),
	},
};

contextBridge.exposeInMainWorld('api', api);
