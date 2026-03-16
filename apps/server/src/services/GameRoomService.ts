import { Injectable, Application, container } from 'viojs-core';

interface PlayerOp { userId: string; opType: string; data: any; }

@Injectable()
export class GameRoomService {
    // roomId -> { frame: number, currentOps: [], players: Set, interval: NodeJS.Timeout }
    private activeRooms = new Map<string, any>();

    public startRoom(roomId: string) {
        if (this.activeRooms.has(roomId)) return;

        const roomState = {
            frame: 1,
            currentOps: [] as PlayerOp[],
            players: new Set<string>(),
            interval: null as any
        };
        this.activeRooms.set(roomId, roomState);

        console.log(`[GameRoomService] Room ${roomId} started frame heartbeat (60Hz)`);

        // 60 Frames per second
        roomState.interval = setInterval(() => {
            this.broadcastFrame(roomId, roomState);
        }, 1000 / 60);
    }

    public joinPlayer(roomId: string, userId: string) {
        const room = this.activeRooms.get(roomId);
        if (room) {
            room.players.add(userId);
        }
    }

    public leavePlayer(roomId: string, userId: string) {
        const room = this.activeRooms.get(roomId);
        if (room) {
            room.players.delete(userId);
            if (room.players.size === 0) {
                console.log(`[GameRoomService] Room ${roomId} is empty, stopping heartbeat.`);
                clearInterval(room.interval);
                this.activeRooms.delete(roomId);
            }
        }
    }

    public collectPlayerOp(roomId: string, userId: string, opPayload: any) {
        const room = this.activeRooms.get(roomId);
        if (!room) return;

        room.currentOps.push({ userId, opType: opPayload.type, data: opPayload.data });
    }

    private broadcastFrame(roomId: string, room: any) {
        if (room.players.size === 0) return;

        const frameData = {
            frame: room.frame++,
            ops: room.currentOps
        };

        // Reset ops for next tick
        room.currentOps = [];

        if (frameData.ops.length > 0 || frameData.frame % 60 === 0) {
           // We resolve the Application from the core container dynamically
           // Or simply we can publish directly through uWS.
           // In this architecture, it's safe to resolve application instance globally
           const app = container.resolve<Application>(Application);

           // Broadcast to uWS C++ pub/sub Topic using fast stringify!
           app.publish(roomId, JSON.stringify(frameData), false);
        }
    }
}
