---
sidebar_position: 2
---

# 快速开始

本章节将引导你从零开始创建一个 Vio.js 项目，并运行一个简单的 HTTP 服务。

## 环境要求

- **Node.js**: v18.0.0 或更高版本
- **TypeScript**: 项目默认使用 TypeScript 开发

## 安装

首先，在你的项目目录中安装 `vio.js` 核心库及其依赖：

```bash
npm install @vio/core
```

*注意：目前 Vio.js 处于开发阶段，请确保你已配置好 workspace 或相关 npm 源。*

## 编写第一个服务

创建一个 `index.ts` 文件，编写以下内容：

```typescript
import { Application, Controller, Get } from '@vio/core';

@Controller('/hello')
class HelloController {
    @Get('/')
    async sayHello() {
        return { message: 'Hello, Vio.js!' };
    }
}

async function bootstrap() {
    const app = new Application();
    
    // 注册控制器
    app.useControllers([HelloController]);
    
    // 启动服务
    await app.listen(3000);
    console.log('Server is running on http://localhost:3000');
}

bootstrap();
```

## 运行项目

使用 `ts-node` 或编译后运行：

```bash
npx ts-node index.ts
```

现在访问 `http://localhost:3000/hello`，你应该能看到：

```json
{
  "message": "Hello, Vio.js!"
}
```

## 下一步

- 了解如何使用 [控制器与路由](./guide/controller.md)
- 探索 [依赖注入](./guide/dependency-injection.md) 的魔法
- 尝试使用 [WebSockets](./guide/websocket.md) 构建实时应用
