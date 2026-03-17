import { App, TemplatedApp, us_listen_socket, HttpRequest, HttpResponse } from 'uWebSockets.js';
import { BaseContext, Middleware, Next } from './Context';
import { Router } from './Router';
import { container } from './Container';
import * as fs from 'fs';
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

    registerNativeRoute(method: string, pattern: string, handler: (res: HttpResponse, req: HttpRequest) => void) {
        const m = method.toLowerCase();
        const app = this.app as any;
        const targetMethod = m === 'delete' ? 'del' : m;
        if (typeof app[targetMethod] === 'function') {
            app[targetMethod](pattern, handler);
        }
    }

    // Register routes through the router
    registerRoutes(controllers: any[]) {
        this.router.register(controllers);
    }

    async handleRequest(res: HttpResponse, reqData: any, params: Record<string, string> = {}, action?: Middleware) {
        let contextAborted = false;
        res.onAborted(() => { contextAborted = true; });

        try {
            const ctx = new BaseContext(res, reqData);
            ctx.params = params;

            // Chain: Global Middlewares -> Route Action (Route Middlewares + Controller Method)
            const composed = this.compose([...this.middlewares, action].filter(Boolean) as Middleware[]);
            await composed(ctx);

            if (!contextAborted && !ctx.responded) {
                this.sendResponse(ctx, contextAborted);
            }
        } catch (err) {
            console.error('Request error:', err);
            if (!contextAborted) {
                res.cork(() => {
                    res.writeStatus('500 Internal Server Error').end('Internal Error');
                });
            }
        }
    }

    extractRequestData(req: HttpRequest) {
        const headers: Record<string, string> = {};
        req.forEach((k, v) => { headers[k] = v; });
        return {
            method: req.getMethod().toUpperCase(),
            url: req.getUrl(),
            query: req.getQuery(),
            headers
        };
    }

    async listen(port: number, cb?: (token: us_listen_socket) => void) {
        this.app.any('/*', (res, req) => {
            if (req.getHeader('upgrade') === 'websocket') {
                res.setYield(true);
                return;
            }
            const reqData = this.extractRequestData(req);
            this.handleRequest(res, reqData);
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
        res.writeStatus(statusMap[status] || `${status} Status`);
        for (const [key, value] of Object.entries(responseHeaders)) {
            if (Array.isArray(value)) value.forEach(v => res.writeHeader(key, v));
            else res.writeHeader(key, value);
        }
    }

    private sendResponse(ctx: BaseContext, contextAborted: boolean) {
        if (contextAborted || ctx.aborted) return;

        const { res, body, _filePath } = ctx;

        // --- BRANCH A: FILE STREAMING ---
        if (_filePath) {
            // ... (keep file streaming logic)
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

                readStream.on('data', (chunk) => {
                    if (typeof chunk === 'string') {
                        chunk = Buffer.from(chunk);
                    }
                    // Try to send chunk via uWebSockets
                    const chunkArrayBuffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer;

                    let ok = false, done = false;
                    res.cork(() => {
                        const result = res.tryEnd(chunkArrayBuffer, totalSize);
                        ok = result[0];
                        done = result[1];
                    });
                    if (!ok && !done) {
                        readStream.pause();
                        res.onWritable(() => { readStream.resume(); return true; });
                    }
                });
                readStream.on('error', () => {
                    if (!contextAborted) {
                        res.cork(() => res.end());
                    }
                });
            });

            ctx.responded = true;
            return;
        }

        // --- BRANCH B: NORMAL JSON / TEXT PAYLOAD ---
        res.cork(() => {
            if (body === undefined && !ctx.responded) {
                ctx.status = 404;
            }
            this.writeHeaders(ctx);
            if (typeof body === 'object') {
                res.writeHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(body));
            } else if (body !== undefined) {
                res.end(String(body));
            } else {
                res.end(JSON.stringify({
                    error: "Not Found",
                    url: ctx.url, method:
                    ctx.method
                }));
            }
        });

        ctx.responded = true;
    }

    private compose(middlewares: Middleware[]): (ctx: BaseContext) => Promise<void> {
        return function (ctx: BaseContext, next?: Next) {
            let index = -1;
            const dispatch = (i: number): Promise<void> => {
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
            };
            return dispatch(0);
        }
    }
}
