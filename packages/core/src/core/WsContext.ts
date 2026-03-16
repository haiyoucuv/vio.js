import { WebSocket } from 'uWebSockets.js';

export class WsContext {
    public data: Record<string, any> = {};
    public query: Record<string, string> = {};
    public url: string = '';

    constructor(private readonly ws: WebSocket<any>) {
        // Retrieve custom data injected during Upgrade
        const userData = ws.getUserData();
        if (userData) {
            this.url = userData.url || '';
            this.query = userData.query || {};
            // Copy everything else so businesses can use it
            Object.assign(this.data, userData);
        }
    }

    /**
     * Extremely fast corked C++ network send
     */
    send(message: string | ArrayBuffer, isBinary: boolean = false): boolean {
        let result = false;
        // Wrapped in cork to prevent socket chunk fragmentation warning during concurrent IO
        this.ws.cork(() => {
            // Returns: 0 = Backpressure | 1 = Success | 2 = Dropped Max Connections
            result = this.ws.send(message, isBinary, false) === 1;
        });
        return result;
    }

    /**
     * Subscribe to a High-Performance C++ Pub/Sub topic
     */
    subscribe(topic: string): boolean {
        return this.ws.subscribe(topic);
    }

    /**
     * Unsubscribe from a topic
     */
    unsubscribe(topic: string): boolean {
        return this.ws.unsubscribe(topic);
    }

    /**
     * Broadcast to all sockets subscribed to this topic globally.
     */
    publish(topic: string, message: string | ArrayBuffer, isBinary: boolean = false): boolean {
        let result = false;
        try {
            // C++ underlying publish. If the socket is detached during @OnClose this will throw.
            // Safely swallow here so Node doesn't crash from wild user attempts.
            this.ws.cork(() => {
                result = this.ws.publish(topic, message, isBinary);
            });
        } catch (e) {
            console.warn('[WsContext] Local socket publish failed (likely closed). Use Application.publish for global broadcasts.');
        }
        return result;
    }

    /**
     * Close the connection securely
     */
    close(code?: number, shortMessage?: string | ArrayBuffer) {
        if (code) {
           this.ws.end(code, shortMessage);
        } else {
           this.ws.close();
        }
    }
    
    /**
     * Extract Player IP
     */
    getRemoteAddressAsText(): string {
        try {
            const buffer = this.ws.getRemoteAddressAsText();
            return Buffer.from(buffer).toString('utf-8');
        } catch(e) {
            return 'Unknown';
        }
    }
}
