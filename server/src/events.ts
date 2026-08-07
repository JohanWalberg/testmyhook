import type { Response } from 'express';

export interface HookEvent {
  type: 'request' | 'rejected' | 'endpoint';
  [key: string]: unknown;
}

/** In-process pub/sub hub delivering events to SSE subscribers per endpoint token. */
export class EventHub {
  private subscribers = new Map<string, Set<Response>>();

  subscribe(token: string, res: Response): () => void {
    let set = this.subscribers.get(token);
    if (!set) {
      set = new Set();
      this.subscribers.set(token, set);
    }
    set.add(res);
    return () => {
      set!.delete(res);
      if (set!.size === 0) this.subscribers.delete(token);
    };
  }

  publish(token: string, event: HookEvent): void {
    const set = this.subscribers.get(token);
    if (!set) return;
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of set) res.write(payload);
  }
}
