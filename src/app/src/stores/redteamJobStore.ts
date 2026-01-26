import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Job {
  id: string;
  status: 'running' | 'complete' | 'error' | 'in-progress';
  logs: string[];
  evalId: string | null;
  result: unknown;
}

export interface RedteamJobState {
  jobs: Map<string, Job>;
  _hasHydrated: boolean;
  addJob: (jobId: string) => void;
  removeJob: (jobId: string) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  getRunningJobs: () => Job[];
  getAllJobs: () => Job[];
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useRedteamJobStore = create<RedteamJobState>()(
  persist(
    (set, get) => ({
      jobs: new Map(),
      _hasHydrated: false,
      addJob: (jobId: string) =>
        set((state) => {
          const newJobs = new Map(state.jobs);
          newJobs.set(jobId, {
            id: jobId,
            status: 'in-progress',
            logs: [],
            evalId: null,
            result: null,
          });
          return { jobs: newJobs };
        }),
      removeJob: (jobId: string) =>
        set((state) => {
          const newJobs = new Map(state.jobs);
          newJobs.delete(jobId);
          return { jobs: newJobs };
        }),
      updateJob: (jobId: string, updates: Partial<Job>) =>
        set((state) => {
          const newJobs = new Map(state.jobs);
          const job = newJobs.get(jobId);
          if (job) {
            newJobs.set(jobId, { ...job, ...updates });
          }
          return { jobs: newJobs };
        }),
      getRunningJobs: () => {
        const state = get();
        return Array.from(state.jobs.values()).filter(
          (job) => job.status === 'running' || job.status === 'in-progress',
        );
      },
      getAllJobs: () => {
        const state = get();
        return Array.from(state.jobs.values());
      },
      setHasHydrated: (hasHydrated: boolean) => set({ _hasHydrated: hasHydrated }),
    }),
    {
      name: 'promptfoo-redteam-jobs',
      storage: {
        getItem: (name) => {
          const data = localStorage.getItem(name);
          if (!data) return null;
          const parsed = JSON.parse(data);
          return {
            ...parsed,
            state: {
              ...parsed.state,
              jobs: new Map(Object.entries(parsed.state.jobs || {})),
            },
          };
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              jobs: Object.fromEntries(value.state.jobs),
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
