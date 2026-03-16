import { create } from 'zustand';

export type SidebarTab = 'photo' | 'hair' | 'clothing' | 'accessories' | 'body' | 'colors' | 'presets' | 'export';

interface UIState {
  // Sidebar
  activeTab: SidebarTab;
  sidebarOpen: boolean;
  searchQuery: string;

  // Camera
  cameraPreset: 'fullBody' | 'face' | 'upper';

  // Loading states
  isBaseModelLoading: boolean;
  loadingAssets: Set<string>;

  // Modals
  activeModal: string | null;

  // Actions
  setActiveTab: (tab: SidebarTab) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  setCameraPreset: (preset: 'fullBody' | 'face' | 'upper') => void;
  setBaseModelLoading: (loading: boolean) => void;
  addLoadingAsset: (id: string) => void;
  removeLoadingAsset: (id: string) => void;
  clearAllLoadingAssets: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activeTab: 'photo',
  sidebarOpen: true,
  searchQuery: '',
  cameraPreset: 'fullBody',
  isBaseModelLoading: true,
  loadingAssets: new Set(),
  activeModal: null,

  setActiveTab: (tab) => set({ activeTab: tab, searchQuery: '' }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setBaseModelLoading: (loading) => set({ isBaseModelLoading: loading }),
  addLoadingAsset: (id) =>
    set((s) => {
      const next = new Set(s.loadingAssets);
      next.add(id);
      return { loadingAssets: next };
    }),
  removeLoadingAsset: (id) =>
    set((s) => {
      const next = new Set(s.loadingAssets);
      next.delete(id);
      return { loadingAssets: next };
    }),
  clearAllLoadingAssets: () => set({ loadingAssets: new Set() }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
