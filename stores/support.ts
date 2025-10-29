import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { SupportTicket, SupportTicketSchema, newTicket, newMessage, type NewTicketInput, type SupportMessage } from '@/lib/validation/support';

type State = {
  tickets: SupportTicket[];
};

type Actions = {
  createTicket: (input: NewTicketInput) => SupportTicket;
  addMessage: (ticketId: string, msg: SupportMessage) => void;
  setStatus: (ticketId: string, status: SupportTicket['status']) => void;
  assign: (ticketId: string, assignedTo: string | null) => void;
  addTag: (ticketId: string, tag: string) => void;
  removeTag: (ticketId: string, tag: string) => void;
  hydrateFromLegacyMocks: (legacy: any) => void;
  subscribeExternal: () => () => void;
};

const STORAGE_KEY = 'envio-legal-support';

export const useSupportStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      tickets: [],

      createTicket: (input) => {
        const t = newTicket(input);
        set({ tickets: [t, ...get().tickets] });
        return t;
      },

      addMessage: (ticketId, msg) => {
        set({
          tickets: get().tickets.map(t =>
            t.id === ticketId
              ? { ...t, messages: [...t.messages, msg], updatedAt: new Date().toISOString() }
              : t
          ),
        });
      },

      setStatus: (ticketId, status) => {
        set({
          tickets: get().tickets.map(t =>
            t.id === ticketId ? { ...t, status, updatedAt: new Date().toISOString() } : t
          ),
        });
      },

      assign: (ticketId, assignedTo) => {
        set({
          tickets: get().tickets.map(t =>
            t.id === ticketId ? { ...t, assignedTo, updatedAt: new Date().toISOString() } : t
          ),
        });
      },

      addTag: (ticketId, tag) => {
        set({
          tickets: get().tickets.map(t =>
            t.id === ticketId && !t.tags.includes(tag)
              ? { ...t, tags: [...t.tags, tag], updatedAt: new Date().toISOString() }
              : t
          ),
        });
      },

      removeTag: (ticketId, tag) => {
        set({
          tickets: get().tickets.map(t =>
            t.id === ticketId
              ? { ...t, tags: t.tags.filter(x => x !== tag), updatedAt: new Date().toISOString() }
              : t
          ),
        });
      },

      hydrateFromLegacyMocks: (legacy) => {
        if (!legacy) return;
        const parsed = Array.isArray(legacy) ? legacy : [];
        const migrated: SupportTicket[] = [];
        for (const item of parsed) {
          const maybe = SupportTicketSchema.safeParse(item);
          if (maybe.success) migrated.push(maybe.data);
        }
        if (migrated.length) set({ tickets: migrated });
      },

      subscribeExternal: () => {
        if (typeof window === 'undefined') return () => {};
        
        let timeoutId: NodeJS.Timeout;
        const handler = (e: StorageEvent) => {
          if (e.key === STORAGE_KEY) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
              const raw = localStorage.getItem(STORAGE_KEY);
              if (!raw) return;
              try {
                const json = JSON.parse(raw);
                if (json?.state?.tickets) {
                  set({ tickets: json.state.tickets });
                }
              } catch (err) {
                console.error('Failed to sync support store:', err);
              }
            }, 250);
          }
        };
        
        window.addEventListener('storage', handler);
        return () => {
          window.removeEventListener('storage', handler);
          clearTimeout(timeoutId);
        };
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted: any, fromVersion) => {
        // Future migration logic can go here
        return persisted as any;
      },
      partialize: (state) => ({ tickets: state.tickets }),
    }
  )
);
