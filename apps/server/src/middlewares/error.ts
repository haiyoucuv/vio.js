import { Middleware, BaseContext, Next } from 'viojs-core';

export const errorMiddleware: Middleware = async (ctx: BaseContext, next: Next) => {
    try {
        await next();
    } catch (err) {
        console.error('Error caught by errorMiddleware:', err);

        let msg = 'Internal Server Error';
        if (typeof err === 'string') {
            msg = err;
        } else if (err instanceof Error) {
            msg = err.message;
        }

        ctx.status = 200; // Force 200 OK as requested
        ctx.body = {
            success: false,
            code: -1,
            msg: msg,
            data: null,
            timestamp: Date.now()
        };
    }
};
