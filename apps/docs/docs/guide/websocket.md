import WsPlayground from '@site/src/components/Playground/WsPlayground';

# WebSockets 长连接

Vio.js 的 WebSocket 系统是基于 uWebSockets.js 原生 C++ 发布/订阅系统（Pub/Sub Area）高度封装而成的。它不仅性能卓越，而且提供了极其简洁的 API。

## 定义 WebSocket 控制器

使用 `@WebSocketController(path)` 装饰器创建一个 WebSocket 处理器。

```typescript
import { WebSocketController, OnOpen, OnMessage, OnClose, WsContext, Application } from '@vio/core';

@WebSocketController('/battle')
export class BattleController {
    constructor(private app: Application) {}

    @OnOpen()
    onJoin(ws: WsContext) {
        console.log('玩家进入');
        ws.subscribe('Global_Room'); // 订阅房间
    }

    @OnMessage()
    onAction(ws: WsContext, message: ArrayBuffer) {
        // 将消息广播给房间内的所有人
        ws.publish('Global_Room', message);
    }

    @OnClose()
    onLeave(ws: WsContext) {
        // 由于连接已断开，必须使用 app (全局上帝模式) 来发布离线消息
        this.app.publish('Global_Room', '玩家离开了游戏');
    }
}
```

<WsPlayground />

## 核心概念

### `WsContext`
WebSocket 控制器的上下文对象。它不是原始的 `ws` 指针，而是经过 Vio.js 安全封装后的代理，提供了：
- `ws.data`: 存储连接相关的自定义数据。
- `ws.subscribe(topic)`: 订阅主题/房间。
- `ws.unsubscribe(topic)`: 取消订阅。
- `ws.publish(topic, message)`: 向主题发送消息。
- `ws.send(message)`: 向当前客户端发送消息。

### 事件装饰器
- `@OnOpen()`: 客户端连接成功。
- `@OnMessage()`: 收到客户端消息，消息默认为 `ArrayBuffer`（追求性能）。
- `@OnClose()`: 连接关闭。

## 发布/订阅系统 (Pub/Sub)

Vio.js 的房间系统直接运行在 C++ 层。这意味着：
1. **零延迟广播**：消息不需要在 JS 虚拟机中遍历整个客户端列表。
2. **极低内存消耗**：在大规模并发下依然保持稳定。

## 🛡️ 离线安全预案

> [!CAUTION]
> **切记**：在 `@OnClose` 事件中，当前的 `ws` 连接已经被销毁。此时绝对不能调用 `ws.publish()`。
> 如果需要向房间发送离线通知，请像示例中那样使用注入的 `Application` 实例：`this.app.publish('topic', msg)`。
