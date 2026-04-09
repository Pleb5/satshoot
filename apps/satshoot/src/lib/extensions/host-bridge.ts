import { writable } from 'svelte/store';

type HostMessage = {
    type: 'request' | 'response' | 'event';
    action: string;
    payload?: unknown;
    id?: string;
};

type EventHandler = (payload: unknown) => void | Promise<void>;

export class ExtensionHostBridge {
    private pending = new Map<
        string,
        { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    private eventHandlers = new Map<string, Set<EventHandler>>();
    private listener: ((event: MessageEvent) => void) | null = null;
    private messageCounter = 0;

    constructor(
        private readonly targetWindow: Window,
        private readonly targetOrigin = '*'
    ) {
        this.listener = (event) => {
            void this.handleMessage(event);
        };

        window.addEventListener('message', this.listener);
    }

    request(action: string, payload?: unknown): Promise<unknown> {
        const id = `${Date.now()}-${this.messageCounter++}`;

        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });

            try {
                this.targetWindow.postMessage(
                    {
                        type: 'request',
                        id,
                        action,
                        payload,
                    } satisfies HostMessage,
                    this.targetOrigin
                );
            } catch (error) {
                this.pending.delete(id);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    onEvent(action: string, handler: EventHandler): () => void {
        if (!this.eventHandlers.has(action)) {
            this.eventHandlers.set(action, new Set());
        }

        const handlers = this.eventHandlers.get(action)!;
        handlers.add(handler);

        return () => {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.eventHandlers.delete(action);
            }
        };
    }

    destroy() {
        if (this.listener) {
            window.removeEventListener('message', this.listener);
            this.listener = null;
        }

        this.pending.forEach(({ reject }, id) => {
            this.pending.delete(id);
            reject(new Error('ExtensionHostBridge destroyed'));
        });

        this.eventHandlers.clear();
    }

    private async handleMessage(event: MessageEvent) {
        if (event.source !== this.targetWindow) return;

        const message = event.data as HostMessage | undefined;
        if (!message || typeof message !== 'object' || typeof message.action !== 'string') return;

        if (message.type === 'response' && message.id) {
            const pending = this.pending.get(message.id);
            if (!pending) return;

            this.pending.delete(message.id);
            pending.resolve(message.payload);
            return;
        }

        if (message.type === 'event') {
            const handlers = this.eventHandlers.get(message.action);
            if (!handlers || handlers.size === 0) return;

            await Promise.all(Array.from(handlers).map((handler) => handler(message.payload)));
        }
    }
}

export const extensionHostBridge = writable<ExtensionHostBridge | null>(null);
