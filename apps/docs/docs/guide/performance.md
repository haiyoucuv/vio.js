# 高性能与背压控制

Vio.js 的诞生就是为了解决传统 Node.js 框架在极端并发和大数据量传输下的性能瓶颈。

## uWebSockets.js 引擎

Vio.js 不使用 Node.js 的 `http` 模块。它直接将逻辑挂载到 `uWebSockets.js` 的 C++ 句柄上。
这带来的优势包括：
- **极高的吞吐量**：减少了 JS 层的抽象开销。
- **极低的内存占用**：通过 C++ 管理缓冲区。

## 背压控制 (Backpressure)

什么是背压？当你的数据下发速度（如从磁盘读取文件）远快于网络传输速度（客户端带宽有限）时，未发送的数据会堆积在内存中。在极端情况下，这会导致 Node.js 内存溢出 (OOM) 崩溃。

Vio.js 实现了精密的数据流管理：

### 自动流式响应

如果你在控制器中返回一个 `fs.ReadStream`，Vio.js 会自动监听底层的 `res.onWritable` 事件。

```typescript
@Get('/download-data')
async downloadData() {
    return fs.createReadStream('large-asset-file.data');
}
```

- 当网络拥塞时，Vio.js 会自动暂停文件读取。
- 当 TCP 缓冲区腾出空间时，再继续读取。
- **这种零拷贝下推** 保证了在下发超大文件（如 静态资源、音视频）时，服务器内存始终保持在一个极低的水平。

## 实时性优化

对于游戏后端，每一毫秒都很关键。Vio.js 通过：
1. **禁用 Nagle 算法**: 默认开启 `TCP_NODELAY`。
2. **C++ Pub/Sub**: 跳过 JS 迭代器。

## 最佳实践

- **避免在控制器中直接 await 大计算**: 虽然 uWS 很快，但 JS 仍是单线程的。
- **利用 ArrayBuffer**: 在 WebSocket 传输中优先使用二进制数据而非 JSON 字符串。
- **使用 DTO 过滤**: 在进入业务层前拦住非法垃圾数据，节省无效开销。
