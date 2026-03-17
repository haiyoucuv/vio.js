# 中间件

Vio.js 采用了优雅的 **洋葱模型 (Onion Model)** 中间件系统，这与 Koa 的开发体验高度一致。

## 如何编写中间件

中间件是一个异步函数，接收 `ctx` (Context) 和 `next` 函数。

```typescript
import { Context, Next } from '@vio/core';

export async function loggerMiddleware(ctx: Context, next: Next) {
    const start = Date.now();
    
    // 进入下一个中间件或路由处理器
    await next();
    
    const ms = Date.now() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
}
```

## 注册中间件

你可以全局注册中间件，也可以在特定控制器上使用。

### 全局注册

```typescript
const app = new Application();
app.use(loggerMiddleware);
```

### 控制器/方法级注册 (Todo: 确认框架是否支持装饰器注册中间件)

> [!NOTE]
> 目前 Vio.js 主要通过 `app.use()` 进行全局注册。中间件按注册顺序依次执行。

## Context 对象

`Context` 对象封装了底层的 uWebSockets.js 请求和响应，提供了便捷的 API：

- `ctx.url`: 请求路径。
- `ctx.method`: HTTP 动词。
- `ctx.query`: 解析后的查询参数。
- `ctx.headers`: 获取请求头。
- `ctx.json()`: 异步解析 JSON Body。
- `ctx.text()`: 获取 Body 文本。
- `ctx.send(data)`: 发送响应。
- `ctx.status(code)`: 设置 HTTP 状态码。

## 洋葱模型流转

当一个请求到达时，它会依次穿过每一个 `await next()` 之前的逻辑，最后到达业务处理器。当处理器执行完毕后，请求会以相反的顺序穿过每一个 `await next()` 之后的逻辑。

这使得中间件非常适合处理：
- 日志记录
- 错误捕获 (`try/catch` 包裹 `next`)
- 权限校验
- 性能监控
