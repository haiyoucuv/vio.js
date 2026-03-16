# Vio.js

*其他语言版本: [English](README.md)*

一个建立在最强 Node.js C++ 网关引擎 [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) 之上的高性能全栈框架。它巧妙地结合了类似于 Koa 的洋葱模型中间件系统、原生 TypeScript 装饰器集成、零依赖的反转控制容器（IoC）依赖注入系统，以及防炸弹的安全 WebSocket 收发器。

它天生就是为了承载海量的帧同步游戏并发网络请求，甚至能够扛着极高背压进行 Spine 文件流的无损下发。

## 🚀 核心特性

- **逆天性能**: 直接将 HTTP/WS 绑定至用 C++ 编写的底层网桥。并实现了静态流式媒体零拷贝下推与 Backpressure（背压）拥塞控制。
- **Koa 式洋葱中间件**: 一如既往且极度优雅的异步中间件系统支持。
- **全系 TypeScript & 装饰器**: 不用再丑陋地写链式挂载语句。只需在类顶部套上 `@Controller`, `@Get`, `@Post` 就可以自动将类接入引擎网关。
- **IoC 容器 (依赖注入)**: 通过 `@Injectable()` 进行全自动服务标记并使用 TypeScript 反射元数据构建。您不需要像组装乐高一样将服务逐个传参！自动解决作用域和全局单例管理。
- **重金打造之 WebSocket Hub**: `@WebSocketController`！原生打通 uWS 的 C++ 发布订阅系统（Pub/Sub Area）。最重要的是：提供了 `WsContext` 的安全软木塞包装，并在 `OnClose` 坠毁时提供上帝视角级的逃生预案，绝不牵连 Node 主进程内存死亡！
- **DTO 暴力参数校验器**: 自带反射校验层，在数据到达您的函数前执行 `@IsRequired()`, `@IsString()`, `@Min()` 扫描。非法类型将立刻抛出 HTTP 友好拦截，彻底干掉乱传入的非法对象。

---

## 📦 快速部署

1. 安装依赖:
   ```bash
   npm install
   ```

2. 启动服务 (带热重载与全 Workspace 跨库监听):
   ```bash
   npm start
   ```

3. 收发测试 API 和 WebSockets 大厅:
   ```bash
   curl -X POST http://localhost:3001/users/ -H "Content-Type: application/json" -d "{\"username\": \"superadmin\", \"age\": 24}"
   
   wscat -c "ws://localhost:3001/battle?token=hello&roomId=Room_01"
   ```

---

## 📘 核心机制 

### 1. HTTP 防暴控制器（自动验证）

将参数定义为一个 Class ，系统会在路由器自动将其安全化！

```typescript
import { Controller, Get, Post, Body, IsRequired, IsInt, Min } from '@vio/core';

export class CreateUserDto {
    @IsRequired('你必须提供用户名！')
    username!: string;

    @IsRequired()
    @IsInt('年龄必须是合法整数！')
    @Min(18, '未满十八岁不要乱调接口啦！')
    age!: number;
    
    // 不包裹的话就是一个自动忽略和宽松穿透的黑洞类型
    extraInfo?: any;
}

@Controller('/users')
export class UserController {
    @Post('/')
    async createUser(@Body() dto: CreateUserDto) {
        // 如果能运行到这行，说明那道严刑拷打的验证墙已经被安全突破了！
        return { success: true, user: dto.username };
    }
}
```

### 2. 依赖注入 (DI 容器)

创建属于框架顶层的单例服务，通过 `@Injectable()`，不需要费劲实例化它们。

```typescript
import { Injectable, Controller, Get } from '@vio/core';

@Injectable() // <--- 加入全球单例户籍卡
export class AuthService {
    verify() { return true; }
}

@Controller('/auth')
export class AuthController {
    // 容器会像魔法一样知道并且自动为你塞入这个 authService 的地址！
    constructor(private authService: AuthService) {} 
    
    @Get('/check')
    async check() { return this.authService.verify(); }
}
```

### 3. 长连接房间帧同步利器

轻松组建持久化的帧同步对战房，不需要写可怕的 `on('message', cb)` 面条代码。

```typescript
import { WebSocketController, OnOpen, OnMessage, OnClose, WsContext, Application } from '@vio/core';

@WebSocketController('/battle')
export class GameSocketController {
    // 神来之笔，把掌握全局生死大权的总控制器 Application 给借过来用
    constructor(private app: Application) {}

    @OnOpen()
    onJoin(ws: WsContext) {
        ws.data.userId = Math.random();
        
        // C++ 级别的疯狂订阅，只要有人朝 `Room_01` 叫唤，所有人都会瞬间收到包
        ws.subscribe('Room_01'); 
    }

    @OnMessage()
    onAction(ws: WsContext, message: ArrayBuffer) {
        ws.publish('Room_01', message); 
    }

    @OnClose()
    onLeave(ws: WsContext) {
        // ✨死亡逃生法：由于掉线的人 ws 指针在内存在已经被连根拔起化为灰烬。
        // 所以要想发布死亡告警不炸掉全服 Node，必须向全局上帝 App 祈求借用总管道发声！
        this.app.publish('Room_01', `User ${ws.data.userId} left`); 
    }
}
```

## ⚠️ 防爆需知

- **Body 解析**: 请求已经被 `ctx.json()` 在后台保护住了，如果您已经在函数参数里使用了 `@Body` 帮你拿参数，千万别手欠在函数内部再去自己去 `await ctx.json()` 一遍。
- **WebSocket 夺命刺客**: 再讲一遍！不要在 `@OnClose` 里面调用 `ws.publish`！这个连接已经死了，死人是不能通过它本人的喉咙发声的。请一定请出 `Application.publish` 大喇叭！
