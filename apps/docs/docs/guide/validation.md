import ApiPlayground from '@site/src/components/Playground/ApiPlayground';

# 数据验证 (DTO)

在高性能应用中，确保输入数据的合法性至关重要。Vio.js 提供了一套内置的验证系统，允许你通过 **数据传输对象 (DTO)** 声明式地校验请求参数。

## 定义 DTO

创建一个普通的 TypeScript 类，并使用验证装饰器标记字段。

```typescript
import { IsRequired, IsInt, Min, IsString } from '@vio/core';

export class CreateUserDto {
    @IsRequired('用户名不能为空')
    @IsString()
    username!: string;

    @IsRequired()
    @IsInt('年龄必须是整数')
    @Min(18, '必须成年才能注册')
    age!: number;
}
```

## 在控制器中使用

将 DTO 类作为 `@Body()` 参数的类型，Vio.js 会在函数执行前拦截并运行验证逻辑。

```typescript
@Controller('/users')
export class UserController {
    @Post('/')
    async createUser(@Body() dto: CreateUserDto) {
        // 如果代码运行到这里，说明数据已通过验证
        return { success: true, user: dto };
    }
}
```

<ApiPlayground 
  method="POST" 
  endpoint="/api/v1/users" 
  title="验证 DTO 拦截器"
  defaultData={{ username: "vio_tester", age: 10 }}
/>

## 常用验证装饰器

- `@IsRequired(message?)`: 必填字段。
- `@IsString(message?)`: 必须是字符串。
- `@IsInt(message?)`: 必须是整数。
- `@Min(value, message?)`: 最小值。
- `@Max(value, message?)`: 最大值。

## 验证失败处理

如果客户端发送的数据不符合 DTO 定义，Vio.js 会自动拦截请求并返回 `400 Bad Request`，其中包含详细的错误提示：

```json
{
  "success": false,
  "errors": [
    "必须成年才能注册"
  ]
}
```

## 防原型链污染 (TODO: 确认现状)

> [!TIP]
> 框架在赋值 DTO 对象时会进行安全过滤，防止非法字段干扰业务逻辑。
