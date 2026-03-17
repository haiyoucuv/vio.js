import { BaseContext, Next, Middleware } from './Context';
import { Application } from './Application';
import {
    CONTROLLER_METADATA, ROUTE_METADATA, RouteDefinition, MIDDLEWARE_METADATA, PARAM_METADATA, ParamDefinition,
    WS_CONTROLLER_METADATA, WS_ON_OPEN_METADATA, WS_ON_MESSAGE_METADATA, WS_ON_CLOSE_METADATA, WS_ON_DRAIN_METADATA
} from '../decorators';
import { WsContext } from './WsContext';
import { validateDTO } from '../validation';
import { container } from './Container';

export class Router {
    constructor(private app: Application) {}

    register(controllers: any[]) {
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
                let fullPath = (prefix + route.path).replace(/\/+/g, '/');
                if (fullPath.length > 1 && fullPath.endsWith('/')) {
                    fullPath = fullPath.slice(0, -1);
                }
                const paramNames: string[] = [];
                const uwsPath = fullPath.replace(/:(\w+)/g, (_, name) => {
                    paramNames.push(name);
                    return ':' + name;
                });

                const routeMiddlewares: Middleware[] = Reflect.getMetadata(MIDDLEWARE_METADATA, controllerClass.prototype, route.methodName) || [];
                const paramsMetadata: ParamDefinition[] = Reflect.getOwnMetadata(PARAM_METADATA, controllerClass.prototype, route.methodName) || [];
                const allMiddlewares = [...controllerMiddlewares, ...routeMiddlewares];

                console.log(`Registering native route: ${route.method.toUpperCase()} ${uwsPath} (O(1))`);

                this.app.registerNativeRoute(route.method, uwsPath, (res, req) => {
                    const params: Record<string, string> = {};
                    paramNames.forEach((name, index) => {
                        params[name] = req.getParameter(index)!;
                    });
                    const reqData = this.app.extractRequestData(req);

                    // Define the specific action for this route
                    const handlerAction: Middleware = async (c: BaseContext) => {
                        const handler = instance[route.methodName].bind(instance);
                        const chain = [...allMiddlewares, async (ctx: BaseContext) => {
                            let args: any[] = [ctx];
                            if (paramsMetadata.length > 0) {
                                const maxIndex = Math.max(...paramsMetadata.map(p => p.index));
                                args = new Array(maxIndex + 1).fill(undefined);
                                const hasBody = paramsMetadata.some(p => p.type === 'body');
                                let bodyData: any = hasBody ? await ctx.json() : null;

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
                                        case 'cookie':
                                            value = meta.name ? ctx.getCookie(meta.name) : ctx.cookies;
                                            break;
                                    }
                                    if (value !== undefined && meta.designType && meta.type !== 'ctx') {
                                        if (meta.designType === Number) value = Number(value);
                                        else if (meta.designType === Boolean) value = (value === 'true' || value === '1' || value === true);
                                        else if (meta.designType !== String && meta.designType.name !== 'Object' && meta.designType.name !== 'Array') {
                                            value = validateDTO(meta.designType, value);
                                        }
                                    }
                                    args[meta.index] = value;
                                }
                            }
                            const result = await handler(...args);
                            if (result !== undefined) ctx.body = result;
                        }];

                        // Execute the middleware chain for this specific route
                        const composed = this.compose(chain);
                        await composed(c);
                    };

                    this.app.handleRequest(res, reqData, params, handlerAction).catch(err => {
                        console.error("Router error:", err);
                    });
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
                    let data = isBinary ? message : Buffer.from(message).toString('utf8');
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
            const dispatch = (i: number): Promise<void> => {
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
            };
            return dispatch(0);
        }
    }

    middleware(): Middleware {
        return async (_ctx, next) => {
            await next();
        };
    }
}
