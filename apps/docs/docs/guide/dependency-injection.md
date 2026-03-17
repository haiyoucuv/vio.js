# 依赖注入 (IoC)

Vio.js 内置了一个零依赖的 **反转控制容器 (Inversion of Control)**。它通过 TypeScript 的装饰器和反射元数据，实现了简单的单例管理和自动依赖解析。

## `@Injectable` 装饰器

将一个类标记为可注入的服务，只需在其上方添加 `@Injectable()`。

```typescript
import { Injectable } from '@vio/core';

@Injectable()
export class UserService {
    private users = [{ id: 1, name: 'Vio User' }];

    getUsers() {
        return this.users;
    }
}
```

## 自动注入

你不需要手动实例化这些服务。只需在控制器或其他服务的 `constructor` 中声明参数类型，Vio.js 会自动为你注入对应的实例。

```typescript
import { Controller, Get, Injectable } from '@vio/core';

@Controller('/users')
export class UserController {
    // Vio.js 会通过构造函数自动寻找并注入 UserService 单例
    constructor(private userService: UserService) {}

    @Get('/')
    async list() {
        return this.userService.getUsers();
    }
}
```

## 生命周期

目前 Vio.js 中的所有 `@Injectable` 服务默认均为 **单例 (Singleton)**。
这意味着在整个应用程序生命周期中，同一个服务类只有一个实例。

## 它的优势

1. **解耦**：类之间不再需要显式导入并手动 `new` 对象。
2. **易于测试**：在单元测试中，你可以轻松替换掉容器中的某个实现。
3. **结构清晰**：整个项目的依赖关系由框架自动管理，避免了底层对象层层透传的麻烦。

## 注意事项

- 确保项目开启了 `emitDecoratorMetadata` 和 `experimentalDecorators` TypeScript 编译选项。
- 只有被装饰器标记的类以及参与了框架生命周期（如 Controller, WebSocketController）的对象才能实现自动注入。
