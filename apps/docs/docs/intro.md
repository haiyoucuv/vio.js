---
sidebar_position: 1
---

# Vio.js 简介

Vio.js 是一个建立在最强 Node.js C++ 网关引擎 [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) 之上的高性能全栈框架。

它巧妙地结合了传统的开发偏好与极致的底层性能：
- **类似于 Koa 的洋葱模型**：极度优雅的异步中间件系统。
- **原生 TypeScript 装饰器集成**：像 NestJS 一样声明式定义路由与服务。
- **零依赖的反转控制容器 (IoC)**：强大的依赖注入系统，自动管理对象生命周期。
- **防炸弹的安全 WebSocket 收发器**：内置基于 C++ 的发布/订阅系统，适配高并发游戏场景。

## 为什么选择 Vio.js?

### 🚀 逆天性能
直接将 HTTP/WS 绑定至用 C++ 编写的底层网桥。并实现了静态流式媒体零拷贝下推与 **Backpressure (背压)** 拥塞控制。这使得 Vio.js 在承载海量并发和下发大文件时具有天然优势。

### 🛡️ 生产安全
虽然追求极速，但 Vio.js 并不牺牲安全性。它提供了 DTO 校验层，在数据到达业务逻辑前进行严苛的反射校验，杜绝非法对象侵入。

### 🏗️ 工程化友好
通过装饰器如 `@Controller`, `@Injectable`, `@WebSocketController`，你的代码结构将变得极其清晰，不再需要编写面条般的路由逻辑。

## 核心特性一览

- **Koa 式中间件**: 熟悉的异步 `next()` 调用流。
- **IoC 容器**: 自动解决构造函数依赖，支持全局单例。
- **WebSocket Hub**: 原生打通 uWS 的 Pub/Sub Area。
- **参数验证器**: 基于类反射的字段校验（`@IsRequired`, `@IsInt`, `@Min` 等）。
- **背压控制**: 精准控制数据流传输，防止 OOM。

---

接下来，你可以按照 [快速开始](./quick-start.md) 引导，在几分钟内搭建起你的第一个 Vio.js 应用。
