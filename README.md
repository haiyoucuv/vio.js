# Vio.js

*Read this in other languages: [简体中文](README_CN.md)*

A high-performance backend framework built on top of [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js), offering a Koa-like middleware architecture, full TypeScript support with decorators, a pure Native Dependency Injection (DI) system, seamless WebSocket integration, and a zero-dependency DTO Validation Engine. 

Designed specifically for handling massively concurrent game servers, heavy Spine file streaming, and microservices logic.

## 🚀 Features

- **Extreme Performance**: Built directly on C++ `uWebSockets.js`. Zero-copy network writes, backpressure-aware static file streaming, and incredibly fast routing.
- **Koa-like Middleware**: Async/await middleware chain (onion model) fully supporting HTTP abstractions.
- **TypeScript First & Decorators**: Full typing support. Use `@Controller`, `@Get`, `@Post`, `@Body` elegantly.
- **IoC Container (Dependency Injection)**: Automatically manages service dependencies using true reflection (`@Injectable()`). Circular dependency free and global singleton aware.
- **WebSocket Gateway**: `@WebSocketController` with C++ native `topic` Pub/Sub integration. Includes frame-safe wrappers (`WsContext`) to protect Node.js from fatal memory pointer crashes.
- **DTO Validation Engine**: High-performance, built-in parameter validator using `@IsRequired()`, `@IsString()`, `@Min()`. Auto-intercepts invalid parameters at the routing layer and throws friendly errors.

---

## 📦 Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server (includes hot-compilation mapped to workspaces):
   ```bash
   npm start
   ```

3. Test API and WebSockets:
   ```bash
   curl -X POST http://localhost:3001/users/ -H "Content-Type: application/json" -d "{\"username\": \"superadmin\", \"age\": 24}"
   
   wscat -c "ws://localhost:3001/battle?token=hello&roomId=Room_01"
   ```

---

## 📘 Core Concepts

### 1. HTTP Controllers & Auto-Validation

Controllers map paths and apply class validations automatically:

```typescript
import { Controller, Get, Post, Body, IsRequired, IsInt, Min } from '@vio/core';

export class CreateUserDto {
    @IsRequired('You must provide a username!')
    username!: string;

    @IsRequired()
    @IsInt('Age must be an integer')
    @Min(18)
    age!: number;
}

@Controller('/users')
export class UserController {
    @Post('/')
    async createUser(@Body() dto: CreateUserDto) {
        // If the execution reaches here, `dto` is 100% type-safe and validated!
        return { success: true, user: dto.username };
    }
}
```

### 2. Dependency Injection (DI)

Create global singletons by marking services with `@Injectable()`. Controllers are automatically injected!

```typescript
import { Injectable, Controller, Get } from '@vio/core';

@Injectable()
export class AuthService {
    verify() { return true; }
}

@Controller('/auth')
export class AuthController {
    // Constructor parameter type is reflected and automatically injected
    constructor(private authService: AuthService) {} 
    
    @Get('/check')
    async check() { return this.authService.verify(); }
}
```

### 3. WebSocket Frame Sync

Easily create long-lived, stateful game rooms. The framework protects Node.js from dying when disconnected WebSockets attempt to broadcast metadata natively!

```typescript
import { WebSocketController, OnOpen, OnMessage, OnClose, WsContext, Application } from '@vio/core';

@WebSocketController('/battle')
export class GameSocketController {
    constructor(private app: Application) {}

    @OnOpen()
    onJoin(ws: WsContext) {
        ws.data.userId = Math.random();
        // Subscribe to a high-perf C++ Topic natively
        ws.subscribe('Room_01'); 
    }

    @OnMessage()
    onAction(ws: WsContext, message: ArrayBuffer) {
        // Broadcast over C++ space
        ws.publish('Room_01', message); 
    }

    @OnClose()
    onLeave(ws: WsContext) {
        // Use Global Application instance to reliably publish system events 
        // after the user's local socket instance is detached
        this.app.publish('Room_01', `User ${ws.data.userId} left`); 
    }
}
```

## ⚠️ Notes

- **Body Parsing**: Request body is buffered automatically. Never manually await `ctx.json()` inside controllers if you map it via `@Body()`.
- **WebSocket Safety**: Never use `ws.publish` inside `@OnClose`. Always rely on `Application.publish` due to C++ pointer invalidation upon socket closure.
