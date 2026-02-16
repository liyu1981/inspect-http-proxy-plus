/** biome-ignore-all lint/suspicious/noExplicitAny: table content props etc */
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// Atom for panel open/close state (persisted to localStorage)
export const isPanelOpenAtom = atomWithStorage("bottom-panel-open", false);

// Atom for active tab ID (persisted to localStorage)
export const activeTabIdAtom = atomWithStorage<string | null>(
  "bottom-panel-active-tab",
  null,
);

export interface BottomPanelTab {
  id: string;
  label: string;
  content?: React.ReactNode | null;
  icon?: React.ComponentType<{ className?: string }>;
  closeable?: boolean;
}

// Serializable tab data for localStorage
export interface SerializableTabData {
  id: string;
  label: string;
  contentProps?: Record<string, any>;
  contentType?: string; // Used to identify which component to reconstruct
  closeable?: boolean;
  timestamp: number; // Track when tab was created/updated
}

const MAX_STORED_TABS = 100;
const TABS_STORAGE_KEY = "bottom-panel-tabs-data";

// Helper functions for localStorage sync
export const saveTabsToStorage = (tabs: BottomPanelTab[]) => {
  const closeableTabs = tabs.filter((tab) => tab.closeable !== false);

  const serializableTabs: SerializableTabData[] = closeableTabs
    .map((tab) => {
      // Extract props from content if it's a React element
      let contentProps: Record<string, any> | undefined;
      let contentType: string | undefined;

      if (
        tab.content &&
        typeof tab.content === "object" &&
        "props" in tab.content
      ) {
        const element = tab.content as any;
        contentProps = element.props;
        contentType =
          element.type?.name || element.type?.displayName || "Unknown";
      }

      return {
        id: tab.id,
        label: tab.label,
        contentProps,
        contentType,
        closeable: tab.closeable,
        timestamp: Date.now(),
      };
    })
    .slice(-MAX_STORED_TABS); // Keep only the last 100 tabs

  try {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(serializableTabs));
  } catch (error) {
    console.error("Failed to save tabs to localStorage:", error);
  }
};

export const loadTabsFromStorage = (): SerializableTabData[] => {
  try {
    const stored = localStorage.getItem(TABS_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as SerializableTabData[];
    return parsed.slice(-MAX_STORED_TABS); // Ensure limit
  } catch (error) {
    console.error("Failed to load tabs from localStorage:", error);
    return [];
  }
};

export const clearStoredTabs = () => {
  try {
    localStorage.removeItem(TABS_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear stored tabs:", error);
  }
};

// Type for tab reconstruction function
export type TabReconstructor = (
  tabData: SerializableTabData,
) => BottomPanelTab | null;

// Default reconstructor (you should provide your own based on your content types)
const defaultTabReconstructor: TabReconstructor = (tabData) => {
  return {
    id: tabData.id,
    label: tabData.label,
    content: null, // No content by default
    closeable: tabData.closeable,
  };
};

// Function to restore tabs from storage
export const restoreTabsFromStorage = (
  reconstructor?: TabReconstructor,
): BottomPanelTab[] => {
  const storedTabs = loadTabsFromStorage();
  const reconstruct = reconstructor || defaultTabReconstructor;

  return storedTabs
    .map((tabData) => reconstruct(tabData))
    .filter((tab): tab is BottomPanelTab => tab !== null);
};

// Atom for tabs
export const tabsAtom = atom<BottomPanelTab[]>([]);

// Derived atom to add a new tab
export const addTabAtom = atom(
  null,
  (
    get,
    set,
    {
      newTab,
      skipSync,
    }: {
      newTab: Omit<BottomPanelTab, "id"> & { id?: string };
      skipSync?: boolean;
    },
  ) => {
    const tabs = get(tabsAtom);
    const found = tabs.find((t) => t.id === newTab.id);

    if (found) {
      const updatedTabs = tabs.map((t) =>
        t.id === newTab.id ? { ...t, ...newTab } : t,
      );
      set(tabsAtom, updatedTabs);
      saveTabsToStorage(updatedTabs); // Sync to storage
      return;
    }

    const tab: BottomPanelTab = {
      ...newTab,
      id: newTab.id || `tab-${Date.now()}`,
      closeable: newTab.closeable ?? true,
    };

    const newTabs = [...tabs, tab];
    set(tabsAtom, newTabs);
    set(activeTabIdAtom, tab.id);
    if (skipSync !== true) {
      saveTabsToStorage(newTabs); // Sync to storage
    }
  },
);

// Derived atom to remove a tab
export const removeTabAtom = atom(null, (get, set, tabId: string) => {
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  const newTabs = tabs.filter((t) => t.id !== tabId);

  set(tabsAtom, newTabs);
  saveTabsToStorage(newTabs); // Sync to storage

  // If removing active tab, switch to first available tab
  if (activeId === tabId && newTabs.length > 0) {
    set(activeTabIdAtom, newTabs[0].id);
  } else if (newTabs.length === 0) {
    set(activeTabIdAtom, null);
  }
});

// Derived atom to update a tab
export const updateTabAtom = atom(
  null,
  (get, set, update: { id: string; updates: Partial<BottomPanelTab> }) => {
    const tabs = get(tabsAtom);
    const updatedTabs = tabs.map((t) =>
      t.id === update.id ? { ...t, ...update.updates } : t,
    );
    set(tabsAtom, updatedTabs);
    saveTabsToStorage(updatedTabs); // Sync to storage
  },
);

// Derived atom to get active tab
export const activeTabAtom = atom((get) => {
  const tabs = get(tabsAtom);
  const activeId = get(activeTabIdAtom);
  return tabs.find((t) => t.id === activeId) || null;
});

// Atom to toggle panel
export const togglePanelAtom = atom(null, (get, set) => {
  set(isPanelOpenAtom, !get(isPanelOpenAtom));
});

// Atom to initialize tabs from storage
export const initializeStoredTabsAtom = atom(
  null,
  (get, set, reconstructor?: TabReconstructor) => {
    const restoredTabs = restoreTabsFromStorage(reconstructor);
    const currentTabs = get(tabsAtom);

    // Add restored tabs one by one, skipping duplicates
    restoredTabs.forEach((restoredTab) => {
      const exists = currentTabs.find((t) => t.id === restoredTab.id);
      if (!exists) {
        // Use addTabAtom to add each tab properly
        // While initializing, we can skip syncing to storage since these are already from storage
        set(addTabAtom, { newTab: restoredTab, skipSync: true });
      }
    });

    // Restore active tab if it exists in restored tabs
    const activeId = get(activeTabIdAtom);
    const allTabs = get(tabsAtom); // Get updated tabs after additions

    if (activeId && !allTabs.find((t) => t.id === activeId)) {
      // Active tab doesn't exist anymore, set to first tab or null
      set(activeTabIdAtom, allTabs.length > 0 ? allTabs[0].id : null);
    }
  },
);
