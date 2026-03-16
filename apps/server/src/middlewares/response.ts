import { Middleware, BaseContext, Next } from 'viojs-core';

export const successMiddleware: Middleware = async (ctx: BaseContext, next: Next) => {
    await next();

    // After handler execution, standardise the response
    console.log("Middleware after next. Body:", ctx.body);
    if (ctx.body !== undefined && !ctx.responded) {
        // Build standard response
        const data = ctx.body;
        const body = {
            success: ctx.status >= 200 && ctx.status < 300,
            code: ctx.status,
            msg: ctx.status >= 200 && ctx.status < 300 ? 'success' : 'error',
            data: data,
            timestamp: Date.now()
        };
        ctx.body = body;
    }
};
