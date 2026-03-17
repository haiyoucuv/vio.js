import { WebSocketController, OnOpen, OnMessage, OnClose, WsContext, Application } from 'viojs-core';

/**
 * WebSocket Controller for Real-time Interaction
 * Demonstrates high-performance WebSocket handling with built-in Pub/Sub.
 */
@WebSocketController('/ws/game')
export class GameSocketController {

    constructor(private readonly app: Application) {}

    @OnOpen()
    async onOpen(ws: WsContext) {
        const roomId = ws.query.roomId || 'default_room';
        
        // Custom user data can be attached to the context
        ws.data.userId = `Player_${Math.floor(Math.random() * 1000)}`;
        ws.data.roomId = roomId;

        // Join a room (Pub/Sub)
        ws.subscribe(roomId);

        // Notify others in the room
        this.app.publish(roomId, JSON.stringify({
            event: 'system',
            message: `${ws.data.userId} has joined the room.`
        }));

        console.log(`[WS] ${ws.data.userId} connected to ${roomId}`);
    }

    @OnMessage()
    async onMessage(ws: WsContext, message: any, isBinary: boolean) {
        if (isBinary) return;

        const text = message.toString();
        const roomId = ws.data.roomId;

        // Broadcast message to the entire room
        this.app.publish(roomId, JSON.stringify({
            event: 'chat',
            sender: ws.data.userId,
            message: text
        }));
    }

    @OnClose()
    async onClose(ws: WsContext) {
        const roomId = ws.data.roomId;
        if (roomId) {
            this.app.publish(roomId, JSON.stringify({
                event: 'system',
                message: `${ws.data.userId} left.`
            }));
        }
    }
}
