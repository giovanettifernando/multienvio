import { useMemo } from 'react';
import { useSupportStore } from '@/stores/support';
import type { Status, Priority } from '@/lib/validation/support';

export function useTickets(filter?: {
  status?: Status[];
  priority?: Priority[];
  query?: string;
  tags?: string[];
  requesterEmail?: string;
}) {
  const tickets = useSupportStore(s => s.tickets);
  
  return useMemo(() => {
    let out = [...tickets].sort((a, b) => (b.updatedAt.localeCompare(a.updatedAt)));
    
    if (filter?.status?.length) {
      out = out.filter(t => filter.status!.includes(t.status));
    }
    
    if (filter?.priority?.length) {
      out = out.filter(t => filter.priority!.includes(t.priority));
    }
    
    if (filter?.tags?.length) {
      out = out.filter(t => filter.tags!.every(tag => t.tags.includes(tag)));
    }
    
    if (filter?.requesterEmail) {
      out = out.filter(t => t.requester.email.toLowerCase() === filter.requesterEmail!.toLowerCase());
    }
    
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      out = out.filter(t =>
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.requester.name.toLowerCase().includes(q) ||
        t.requester.email.toLowerCase().includes(q)
      );
    }
    
    return out;
  }, [tickets, JSON.stringify(filter)]);
}

export function useTicket(ticketId: string | null) {
  const ticket = useSupportStore(s => ticketId ? s.tickets.find(t => t.id === ticketId) : undefined);
  const addMessage = useSupportStore(s => s.addMessage);
  const setStatus = useSupportStore(s => s.setStatus);
  const assign = useSupportStore(s => s.assign);
  const addTag = useSupportStore(s => s.addTag);
  const removeTag = useSupportStore(s => s.removeTag);

  return { ticket, addMessage, setStatus, assign, addTag, removeTag };
}

export function useCreateTicket() {
  return useSupportStore(s => s.createTicket);
}

export function useSupportActions() {
  const createTicket = useSupportStore(s => s.createTicket);
  const addMessage = useSupportStore(s => s.addMessage);
  const setStatus = useSupportStore(s => s.setStatus);
  const assign = useSupportStore(s => s.assign);
  const addTag = useSupportStore(s => s.addTag);
  const removeTag = useSupportStore(s => s.removeTag);

  return { createTicket, addMessage, setStatus, assign, addTag, removeTag };
}
