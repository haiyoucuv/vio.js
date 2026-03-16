import { BaseContext, Next, Middleware } from './Context';
import { Application } from './Application';
import {
    CONTROLLER_METADATA, ROUTE_METADATA, RouteDefinition, MIDDLEWARE_METADATA, PARAM_METADATA, ParamDefinition,
    WS_CONTROLLER_METADATA, WS_ON_OPEN_METADATA, WS_ON_MESSAGE_METADATA, WS_ON_CLOSE_METADATA, WS_ON_DRAIN_METADATA
} from '../decorators';
import { WsContext } from './WsContext';
import { validateDTO, ValidationError } from '../validation';

import { container } from './Container';

export class Router {
    private routes: Array<{
        method: string;
        path: RegExp; // Simple RegExp for now
        paramNames: string[];
        handler: (ctx: BaseContext) => Promise<void>;
    }> = [];

    constructor(private app: Application) {}

    register(controllers: any[]) {
        console.log("HELLO FROM ROUTER REGISTER");
        controllers.forEach(controllerClass => {
            // Instantiate securely with DI Container!
            const instance = container.resolve<any>(controllerClass);

            // Check if this is a WebSocket Controller
            const wsPrefix = Reflect.getMetadata(WS_CONTROLLER_METADATA, controllerClass);
            if (wsPrefix !== undefined) {
                this.registerWs(wsPrefix, controllerClass, instance);
                return; // Skip normal HTTP routing
            }

            const prefix = Reflect.getMetadata(CONTROLLER_METADATA, controllerClass);
            const routes: RouteDefinition[] = Reflect.getMetadata(ROUTE_METADATA, controllerClass);
            const controllerMiddlewares: Middleware[] = Reflect.getMetadata(MIDDLEWARE_METADATA, controllerClass) || [];

            if (!routes) return;

            routes.forEach(route => {
                const fullPath = (prefix + route.path).replace(/\/+/g, '/');
                // Convert path to regex /users/:id -> /^\/users\/([^/]+)$/
                const { re, keys } = this.pathToRegexp(fullPath);

                const routeMiddlewares: Middleware[] = Reflect.getMetadata(MIDDLEWARE_METADATA, controllerClass.prototype, route.methodName as string) || [];
                const paramsMetadata: ParamDefinition[] = Reflect.getOwnMetadata(PARAM_METADATA, controllerClass.prototype, route.methodName as string) || [];

                // Compose: Controller Middlewares -> Route Middlewares -> Handler
                const allMiddlewares = [...controllerMiddlewares, ...routeMiddlewares];

                console.log(`Registering route: ${route.method.toUpperCase()} ${fullPath} -> regex: ${re}`);

                this.routes.push({
                    method: route.method.toUpperCase(),
                    path: re,
                    paramNames: keys,
                    handler: async (ctx: BaseContext) => {
                       const handler = instance[route.methodName].bind(instance);
                       console.log("Handler loaded for", route.methodName);

                       // Create a mini-chain for this route
                       const chain = [...allMiddlewares, async (ctx: BaseContext, next: Next) => {
                           let args: any[] = [ctx]; // Default backwards-compatible fallback array

                           // If parameter decorators are used, we switch into reflection injection mode
                           if (paramsMetadata.length > 0) {
                               const maxIndex = Math.max(...paramsMetadata.map(p => p.index));
                               args = new Array(maxIndex + 1).fill(undefined);

                               const hasBody = paramsMetadata.some(p => p.type === 'body');
                               let bodyData: any = null;
                               if (hasBody) {
                                   bodyData = await ctx.json();
                               }

                               for (const meta of paramsMetadata) {
                                   let value: any;
                                   switch (meta.type) {
                                       case 'ctx':
                                           value = ctx;
                                           break;
                                       case 'param':
                                           value = meta.name ? ctx.params[meta.name] : ctx.params;
                                           break;
                                       case 'query':
                                           value = meta.name ? ctx.queries[meta.name] : ctx.queries;
                                           break;
                                       case 'body':
                                           value = meta.name ? (bodyData ? bodyData[meta.name] : undefined) : bodyData;
                                           break;
                                   }

                                   // Simple auto-casting for strongly typed metadata via typescript design:paramtypes
                                   if (value !== undefined && meta.designType && meta.type !== 'ctx') {
                                       if (meta.designType === Number) {
                                           const parsed = Number(value);
                                           if (isNaN(parsed)) throw new ValidationError([`Parameter '${meta.name}' must be a number`]);
                                           value = parsed;
                                       } else if (meta.designType === Boolean) {
                                           value = value === 'true' || value === '1' || value === true;
                                       } else if (meta.designType === String) {
                                           value = String(value);
                                       } else if (meta.designType !== BaseContext && meta.designType !== WsContext && meta.designType.name !== 'Object' && meta.designType.name !== 'Array') {
                                           // It's a potential DTO class! Execute native Validation layer
                                           value = validateDTO(meta.designType, value);
                                       }
                                   } else if (value === undefined && meta.designType && meta.type !== 'ctx' && meta.designType.name !== 'Object' && meta.designType.name !== 'String' && meta.designType.name !== 'Number' && meta.designType.name !== 'Boolean') {
                                       // Body was undefined/null, let validation engine check if @IsRequired complains!
                                       value = validateDTO(meta.designType, {});
                                   }

                                   args[meta.index] = value;
                               }
                           }

                           // Execute handler with injected args (passing undefined will trigger ES6 default arguments)
                           const result = await handler(...args);
                           console.log("Handler returned:", result);
                           if (result !== undefined) {
                               ctx.body = result;
                           }
                       }];

                       const composed = this.compose(chain);
                       await composed(ctx);
                    }
                });
            });
        });
    }

    private registerWs(prefix: string, controllerClass: any, instance: any) {
        const fullPath = prefix.replace(/\/+/g, '/');

        const openMethod = Reflect.getMetadata(WS_ON_OPEN_METADATA, controllerClass);
        const messageMethod = Reflect.getMetadata(WS_ON_MESSAGE_METADATA, controllerClass);
        const closeMethod = Reflect.getMetadata(WS_ON_CLOSE_METADATA, controllerClass);
        const drainMethod = Reflect.getMetadata(WS_ON_DRAIN_METADATA, controllerClass);

        console.log(`Registering WS route: ${fullPath}`);

        this.app.registerWsRoute(fullPath, {
            idleTimeout: 32,
            maxBackpressure: 1024 * 1024 * 10,
            maxPayloadLength: 1024 * 1024 * 16,
            upgrade: (res: any, req: any, context: any) => {
                // Must read req here safely because req is invalidated outside
                const url = req.getUrl();
                const queryStr = req.getQuery();
                // Extremely simple query parser
                const query: Record<string, string> = {};
                if (queryStr) {
                    queryStr.split('&').forEach((pair: string) => {
                        const [k, v] = pair.split('=');
                        query[k] = decodeURIComponent(v || '');
                    });
                }

                res.upgrade({ url, query },
                    req.getHeader('sec-websocket-key'),
                    req.getHeader('sec-websocket-protocol'),
                    req.getHeader('sec-websocket-extensions'),
                    context
                );
            },
            open: (ws: any) => {
                const ctx = new WsContext(ws);
                ws.customCtx = ctx;
                if (openMethod) {
                    instance[openMethod](ctx);
                }
            },
            message: (ws: any, message: any, isBinary: boolean) => {
                if (messageMethod) {
                    let data: any = message;
                    if (!isBinary && message instanceof ArrayBuffer) {
                        data = Buffer.from(message).toString('utf8');
                    }
                    instance[messageMethod](ws.customCtx, data, isBinary);
                }
            },
            close: (ws: any, code: number, message: any) => {
                if (closeMethod) {
                    instance[closeMethod](ws.customCtx, code, message);
                }
            },
            drain: (ws: any) => {
                if (drainMethod) {
                    instance[drainMethod](ws.customCtx);
                }
            }
        });
    }

    // Helper to compose middlewares (similar to Application.compose but specific for this scope if needed)
    // Actually we can reuse or duplicate it. Let's duplicate for simplicity to keep Router standalone.
    private compose(middlewares: Middleware[]): (ctx: BaseContext) => Promise<void> {
        return function (ctx: BaseContext, next?: Next) {
            let index = -1;
            return dispatch(0);
            function dispatch(i: number): Promise<void> {
                if (i <= index) return Promise.reject(new Error('next() called multiple times'));
                index = i;
                let fn = middlewares[i];
                if (i === middlewares.length) fn = next as Middleware;
                if (!fn) return Promise.resolve();
                try {
                    return Promise.resolve(fn(ctx, dispatch.bind(null, i + 1)));
                } catch (err) {
                    return Promise.reject(err);
                }
            }
        }
    }

    private pathToRegexp(path: string): { re: RegExp, keys: string[] } {
        const keys: string[] = [];
        // Escape special chars except :
        let pattern = path.replace(/([.+*?^$(){}|[\]\\])/g, '\\$1');
        // Replace :param with capture group
        pattern = pattern.replace(/:(\w+)/g, (_, key) => {
            keys.push(key);
            return '([^/]+)';
        });
        // Remove trailing slash if it exists in the pattern for optional matching
        if (pattern.endsWith('/') && pattern.length > 1) {
            pattern = pattern.slice(0, -1);
        }
        // Add start/end anchors and optional trailing slash
        return { re: new RegExp(`^${pattern}/?$`), keys };
    }

    middleware(): Middleware {
        return async (ctx: BaseContext, next: Next) => {
            // Find matching route
            const matched = this.findRoute(ctx.method, ctx.url);
            if (matched) {
                console.log(`Route matched: ${ctx.method} ${ctx.url}`);
                ctx.params = matched.params;
                await matched.handler(ctx);
            } else {
                console.log(`No route matched for: ${ctx.method} ${ctx.url}`);
                await next();
            }
        };
    }

    private findRoute(method: string, url: string) {
        for (const route of this.routes) {
            // console.log(`Checking route: ${route.method} ${route.path} vs ${method} ${url}`);
            if (route.method !== method && route.method !== 'ANY') continue;
            const match = route.path.exec(url); // url in uWS does not include query string
            if (match) {
                const params: Record<string, string> = {};
                route.paramNames.forEach((name, index) => {
                    params[name] = decodeURIComponent(match[index + 1] || '');
                });
                return { handler: route.handler, params };
            }
        }
        return null;
    }
}
