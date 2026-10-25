import { create } from 'zustand';
import type { AuthUser, PermissionString, RoleId, ScopedRoleAssignment } from '../types/api';
import { getQueuedMutations } from '../lib/offline/syncQueue';

interface AppState {
  user: AuthUser | null;
  permissions: PermissionString[];
  authChecked: boolean;
  simulatedOffline: boolean;
  browserOffline: boolean;
  queuedCount: number;
  unreadNotificationsCount: number;
  sidebarOpen: boolean;

  // Convenience computed / aliases
  currentUser: AuthUser | null;
  currentRole: RoleId;
  activeScope: ScopedRoleAssignment | null;
  isOnline: boolean;
  isOfflineSimulated: boolean;
  queuedMutationCount: number;
  isAuthenticated: boolean;

  setSession: (user: AuthUser | null, permissions: PermissionString[]) => void;
  clearSession: () => void;
  logout: () => void;
  setAuthChecked: (val: boolean) => void;
  setSimulatedOffline: (val: boolean) => void;
  toggleOfflineSimulation: () => void;
  setBrowserOffline: (val: boolean) => void;
  refreshQueuedCount: () => Promise<void>;
  setQueuedMutationCount: (count: number) => void;
  setUnreadNotificationsCount: (count: number) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  currentUser: null,
  currentRole: 'ProducerIndividual',
  activeScope: null,
  permissions: [],
  authChecked: false,
  simulatedOffline: false,
  isOfflineSimulated: false,
  browserOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  queuedCount: 0,
  queuedMutationCount: 0,
  unreadNotificationsCount: 3,
  sidebarOpen: false,
  isAuthenticated: false,

  setSession: (user, permissions) => {
    const active = user?.scopedRoles?.find((s) => s.id === user.activeScopeId) ?? null;
    const role = active?.roleId ?? user?.primaryRole ?? 'ProducerIndividual';
    set({
      user,
      currentUser: user,
      currentRole: role,
      activeScope: active,
      permissions,
      authChecked: true,
      isAuthenticated: !!user,
    });
  },

  clearSession: () =>
    set({
      user: null,
      currentUser: null,
      currentRole: 'ProducerIndividual',
      activeScope: null,
      permissions: [],
      authChecked: true,
      isAuthenticated: false,
    }),

  logout: () => {
    get().clearSession();
  },

  setAuthChecked: (val) => set({ authChecked: val }),

  setSimulatedOffline: (val) => set({ simulatedOffline: val, isOfflineSimulated: val }),

  toggleOfflineSimulation: () =>
    set((state) => ({
      simulatedOffline: !state.simulatedOffline,
      isOfflineSimulated: !state.simulatedOffline,
    })),

  setBrowserOffline: (val) => set({ browserOffline: val, isOnline: !val }),

  refreshQueuedCount: async () => {
    try {
      const list = await getQueuedMutations();
      set({ queuedCount: list.length, queuedMutationCount: list.length });
    } catch (error) {
      console.error('Unable to read the offline submission queue:', error);
    }
  },

  setQueuedMutationCount: (count) => set({ queuedCount: count, queuedMutationCount: count }),

  setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setBrowserOffline(false);
  });
  window.addEventListener('offline', () => {
    useAppStore.getState().setBrowserOffline(true);
  });
  window.addEventListener('dcfms_queue_updated', () => {
    void useAppStore.getState().refreshQueuedCount();
  });
  void useAppStore.getState().refreshQueuedCount();
}
