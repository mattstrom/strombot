/// <reference types="vite/client" />

import type { StrombotApi } from '../../shared/api';

declare global {
	interface Window {
		api: StrombotApi;
	}
}

export {};
