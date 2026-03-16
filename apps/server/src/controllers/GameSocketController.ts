import { WebSocketController, OnOpen, OnMessage, OnClose, WsContext, Application } from 'viojs-core';
import { GameRoomService } from '../services/GameRoomService';
import { AuthService } from '../services/AuthService';

@WebSocketController('/battle')
export class GameSocketController {

    // Dependency Injection works seamlessly for WebSockets as well!
    constructor(
        private readonly roomService: GameRoomService,
        private readonly authService: AuthService,
        private readonly app: Application
    ) {}

    @OnOpen()
    async onPlayerJoin(ws: WsContext) {
        const token = ws.query.token;
        const roomId = ws.query.roomId || 'lobby';

        // Fake auth
        if (!token) {
            ws.close(4001, "Permission Denied: Missing Token");
            return;
        }

        // Bind data safely to C++ socket context
        ws.data.userId = `User_${Math.random().toString(36).substr(2, 5)}`;
        ws.data.roomId = roomId;

        console.log(`[Battle Controller] ${ws.data.userId} connected. IP: ${ws.getRemoteAddressAsText()}`);

        // Subscribe socket natively in C++ topic matching the room ID
        ws.subscribe(roomId);

        // Join room and start frame logic
        this.roomService.startRoom(roomId);
        this.roomService.joinPlayer(roomId, ws.data.userId);

        // Best Practice: System broadcast uses Master Application instance
        this.app.publish(roomId, JSON.stringify({ event: 'system', msg: `${ws.data.userId} joined ${roomId}!` }));
    }

    @OnMessage()
    onPlayerAction(ws: WsContext, message: ArrayBuffer, isBinary: boolean) {
        if (isBinary) {
            // Drop complex binary logic in demo, assume text json
            return;
        }

        try {
            const strMsg = Buffer.from(message).toString('utf-8');
            const payload = JSON.parse(strMsg);

            // Send action to heart beat engine
            this.roomService.collectPlayerOp(ws.data.roomId, ws.data.userId, payload);
        } catch (e) {
            ws.send("Invalid Frame Data");
        }
    }

    @OnClose()
    onPlayerLeave(ws: WsContext, code: number, message: ArrayBuffer) {
        console.log(`[Battle Controller] Player ${ws.data.userId} disconnected (Code: ${code}).`);
        if (ws.data.roomId && ws.data.userId) {
            this.roomService.leavePlayer(ws.data.roomId, ws.data.userId);
            // Must use APP to publish since user WS pointer is already dead in C++ space
            this.app.publish(ws.data.roomId, JSON.stringify({ event: 'system', msg: `${ws.data.userId} left.` }));
        }
    }
}
