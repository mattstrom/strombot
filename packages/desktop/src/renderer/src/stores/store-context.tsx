import { createContext, type ReactNode, useContext, useState } from 'react';

import { RootStore } from './root-store';

const StoreContext = createContext<RootStore | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
	const [store] = useState(() => new RootStore());

	return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStores(): RootStore {
	const store = useContext(StoreContext);
	if (!store) {
		throw new Error('useStores must be used within a StoreProvider');
	}

	return store;
}
