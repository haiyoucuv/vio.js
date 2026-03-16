import { Middleware, BaseContext, Next } from 'viojs-core';
import * as path from 'path';

export interface StaticOptions {
    index?: string;
    maxAge?: number;
}

export const staticMiddleware = (rootPath: string, options: StaticOptions = {}): Middleware => {
    return async (ctx: BaseContext, next: Next) => {
        // Only serve static files on GET or HEAD
        if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
            return await next();
        }

        // Extremely simple static mapping
        let reqPath = decodeURIComponent(ctx.url);

        // Handle index file fallback for root
        if (reqPath === '/' && options.index) {
            reqPath = '/' + options.index;
        }

        // Prevent directory traversal attacks
        const normalizedPath = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
        const targetPath = path.join(rootPath, normalizedPath);

        // Security check: ensure target path is still inside root path
        if (!targetPath.startsWith(rootPath)) {
            return await next();
        }

        try {
            const stat = require('fs').statSync(targetPath);
            if (stat.isFile()) {
                // Expose a Cache-Control if user provided maxAge
                if (options.maxAge !== undefined) {
                     ctx.responseHeaders['Cache-Control'] = `public, max-age=${options.maxAge}`;
                }

                // Stream the file seamlessly
                ctx.sendFile(targetPath);
                // Do NOT call next(), as static file served effectively handles the request
                return;
            }
        } catch(e) {
            // File not found or inaccessible, just pass to the next middleware (e.g. router)
        }

        await next();
    };
};
