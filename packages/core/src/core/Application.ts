import { App, TemplatedApp, us_listen_socket } from 'uWebSockets.js';
import { BaseContext, Middleware, Next } from './Context';
import { Router } from './Router';
import { container } from './Container';
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime-types';

export class Application {
    private app: TemplatedApp;
    private middlewares: Middleware[] = [];
    private router: Router;

    constructor() {
        this.app = App();
        this.router = new Router(this);
        // Bind the current Application instance to the DI container for global retrieval
        container.instances.set(Application, this);
    }

    use(middleware: Middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    // Global fast broadcast
    publish(topic: string, message: string | ArrayBuffer, isBinary: boolean = false, compress: boolean = false) {
        this.app.publish(topic, message, isBinary, compress);
    }

    // Register a WebSocket namespace
    registerWsRoute(pattern: string, behavior: any) {
        // pattern must be uWS format, e.g. /* or /room/*
        this.app.ws(pattern, behavior);
    }

    // Register router routes
    registerRoutes(controllers: any[]) {
        console.error("Application.registerRoutes called with", controllers.length, "controllers");
        this.router.register(controllers);
        this.use(this.router.middleware());
    }

    async listen(port: number, cb?: (token: us_listen_socket) => void) {
        this.app.any('/*', async (res, req) => {
            const isUpgrade = req.getHeader('upgrade') === 'websocket';
            if (isUpgrade) {
                res.setYield(true);
                return;
            }

            console.error("DEBUG ENTERED HANDLER");
            const url = req.getUrl();
            console.error("URL:", url);
            let contextAborted = false;

            try {
                // Create context
                const ctx = new BaseContext(res, req);
                console.log(`Incoming request: ${ctx.method} ${ctx.url}`);

                // Keep track of abort safely beyond context setup since we are going async heavily
                res.onAborted(() => {
                    ctx.aborted = true;
                    contextAborted = true;
                });

                // Execute middleware chain
                try {
                    if (contextAborted) return;

                    const composed = this.compose(this.middlewares);
                    await composed(ctx);

                    if (!contextAborted && !ctx.responded) {
                        this.sendResponse(ctx, contextAborted);
                    }
                } catch (err) {
                    console.error('Middleware error:', err);
                    if (!contextAborted) {
                        res.writeStatus('500 Internal Server Error').end('Internal Server Error');
                    }
                }
            } catch (err) {
                console.error('Context creation error:', err);
                if (!contextAborted) {
                     res.writeStatus('500 Internal Server Error').end('Context Error');
                }
            }
        });

        this.app.listen(port, (token) => {
            if (cb) cb(token);
            else {
                if (token) {
                    console.log('Listening to port ' + port);
                } else {
                    console.log('Failed to listen to port ' + port);
                }
            }
        });
    }

    // Extracted headers writer
    private writeHeaders(ctx: BaseContext) {
        const { res, status, responseHeaders } = ctx;

        const statusMap: Record<number, string> = {
            200: '200 OK',
            201: '201 Created',
            204: '204 No Content',
            400: '400 Bad Request',
            401: '401 Unauthorized',
            403: '403 Forbidden',
            404: '404 Not Found',
            500: '500 Internal Server Error'
        };
        const statusText = statusMap[status] || `${status} Status`;

        res.writeStatus(statusText);
        for (const [key, value] of Object.entries(responseHeaders)) {
            if (Array.isArray(value)) {
                value.forEach(v => res.writeHeader(key, v));
            } else {
                res.writeHeader(key, value);
            }
        }
    }

    private sendResponse(ctx: BaseContext, contextAborted: boolean) {
        if (contextAborted) return;

        const { res, body, _filePath } = ctx;

        // --- BRANCH A: FILE STREAMING ---
        if (_filePath) {
            fs.stat(_filePath, (err, stats) => {
                if (err || !stats.isFile() || contextAborted || ctx.aborted) {
                    if (!contextAborted && !ctx.aborted) {
                       ctx.status = 404;
                       res.cork(() => {
                           this.writeHeaders(ctx);
                           res.end('File Not Found');
                       });
                    }
                    return;
                }

                const totalSize = stats.size;

                // Basic Mime type guess if not set
                if (!ctx.responseHeaders['Content-Type']) {
                    const contentType = mime.lookup(_filePath);
                    ctx.responseHeaders['Content-Type'] = contentType || 'application/octet-stream';
                }

                res.cork(() => {
                    this.writeHeaders(ctx);
                });

                let readStream = fs.createReadStream(_filePath);

                readStream.on('data', (chunk: string | Buffer) => {
                    if (typeof chunk === 'string') {
                        chunk = Buffer.from(chunk);
                    }
                    // Try to send chunk via uWebSockets
                    const chunkArrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;

                    let ok = false;
                    let done = false;

                    res.cork(() => {
                        const result = res.tryEnd(chunkArrayBuffer, totalSize);
                        ok = result[0];
                        done = result[1];
                    });

                    if (done) {
                        // Current chunk ended successfully and stream completed (if it was the last piece)
                    } else if (ok) {
                        // Chunk successfully buffered to C++ space
                    } else {
                        // **Backpressure activated!**
                        // C++ buffer is full (Client network is slow) -> Pause reading from Disk!
                        readStream.pause();

                        // Wait for C++ buffer to drain
                        res.onWritable((offset) => {
                            // C++ buffer drained, we can resume reading from Disk
                            readStream.resume();
                            // Important: You must return true explicitly to tell uWebSockets the stream is still alive
                            return true;
                        });
                    }
                });

                readStream.on('error', () => {
                   if (!contextAborted && !ctx.aborted) {
                       res.cork(() => {
                           res.end();
                       });
                   }
                });

            });

            ctx.responded = true;
            return;
        }

        // --- BRANCH B: NORMAL JSON / TEXT PAYLOAD ---
        res.cork(() => {
            this.writeHeaders(ctx);
            if (typeof body === 'object') {
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(body));
            } else if (body) {
                 res.end(String(body));
            } else {
                // Default 404 behavior if no body is set
                res.writeStatus('404 Not Found');
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: "Not Found", url: ctx.url, method: ctx.method }));
            }
        });

        ctx.responded = true;
    }

    private compose(middlewares: Middleware[]): (ctx: BaseContext) => Promise<void> {
        return function (ctx: BaseContext, next?: Next) {
            let index = -1;
            return dispatch(0);

            function dispatch(i: number): Promise<void> {
                if (i <= index) return Promise.reject(new Error('next() called multiple times'));
                index = i;
                let fn = middlewares[i];
                if (i === middlewares.length) fn = next as Middleware; // End of chain
                if (!fn) return Promise.resolve();
                try {
                    return Promise.resolve(fn(ctx, dispatch.bind(null, i + 1)));
                } catch (err) {
                    return Promise.reject(err);
                }
            }
        }
    }
}
