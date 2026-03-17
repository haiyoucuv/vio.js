import ApiPlayground from '@site/src/components/Playground/ApiPlayground';

# 控制器与路由

Vio.js 使用类装饰器来定义路由。这种方式不仅代码结构清晰，还能利用 TypeScript 的类型系统提供更好的开发体验。

## 定义控制器

使用 `@Controller(path)` 装饰器标记一个类作为 HTTP 控制器。

```typescript
import { Controller, Get, Post, Body, Query } from '@vio/core';

@Controller('/users')
export class UserController {
    // 处理 GET /users
    @Get('/')
    async listUsers() {
        return [{ id: 1, name: 'Alice' }];
    }

    // 处理 POST /users
    @Post('/')
    async createUser(@Body() data: any) {
        return { success: true, data };
    }
}
```

<ApiPlayground 
  method="GET" 
  endpoint="/api/v1/users/:id" 
  title="获取用户信息 (Path 参数测试)"
/>

## 路由方法

Vio.js 支持常见的 HTTP 谓词装饰器：
- `@Get(path)`
- `@Post(path)`
- `@Put(path)`
- `@Delete(path)`
- `@Patch(path)`

## 获取请求参数

你可以通过参数装饰器直接在函数参数中获取请求数据，Vio.js 会自动完成注入。

### `@Body()` 
获取请求体（JSON）。

```typescript
@Post('/register')
async register(@Body() dto: RegisterDto) {
    // dto 已经是解析并验证过的对象
}
```

### `@Query()`
获取 URL 查询参数。

```typescript
@Get('/search')
async search(@Query('q') keyword: string) {
    // 访问 /search?q=vio
}
```

### `@Param()`
获取路由参数。

```typescript
@Get('/:id')
async getUser(@Param('id') userId: string) {
    // 访问 /users/123
}
```

### `@Ctx()`
获取原始上下文 `Context` 对象。

```typescript
import { Context } from '@vio/core';

@Get('/debug')
async debug(@Ctx() ctx: Context) {
    console.log(ctx.method);
}
```

## 响应处理

在控制器方法中，你可以直接返回：
- **Object**: 自动序列化为 JSON，Content-Type 为 `application/json`。
- **String**: 返回纯文本。
- **Stream**: 自动处理流输出（支持背压控制）。
- **void**: 如果手动操作了 `ctx.res`，可以不返回任何值。
