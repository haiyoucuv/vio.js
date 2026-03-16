import { BaseContext, Next } from 'viojs-core';

export interface CookieOptions {
    maxAge?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
}

declare module 'viojs-core' {
    interface BaseContext {
        getCookie(name: string): string | undefined;
        setCookie(name: string, value: string, options?: CookieOptions): void;
    }
}

export const cookieMiddleware = () => {
    return async (ctx: BaseContext, next: Next) => {
        let parsedCookies: Record<string, string> | undefined;

        ctx.getCookie = (name: string): string | undefined => {
            if (!parsedCookies) {
                parsedCookies = {};
                const cookieHeader = ctx.headers['cookie'];
                if (cookieHeader) {
                    cookieHeader.split(';').forEach(c => {
                        const [k, v] = c.split('=');
                        if (k && v) {
                            parsedCookies![k.trim()] = decodeURIComponent(v.trim());
                        }
                    });
                }
            }
            return parsedCookies[name];
        };

        ctx.setCookie = (name: string, value: string, options: CookieOptions = {}) => {
            let cookieStr = `${name}=${encodeURIComponent(value)}`;
            if (options.maxAge !== undefined) cookieStr += `; Max-Age=${options.maxAge}`;
            if (options.path) cookieStr += `; Path=${options.path}`;
            if (options.domain) cookieStr += `; Domain=${options.domain}`;
            if (options.secure) cookieStr += `; Secure`;
            if (options.httpOnly) cookieStr += `; HttpOnly`;
            if (options.sameSite) cookieStr += `; SameSite=${options.sameSite}`;

            if (!ctx.responseHeaders['Set-Cookie']) {
                ctx.responseHeaders['Set-Cookie'] = [];
            } else if (typeof ctx.responseHeaders['Set-Cookie'] === 'string') {
                ctx.responseHeaders['Set-Cookie'] = [ctx.responseHeaders['Set-Cookie']];
            }
            (ctx.responseHeaders['Set-Cookie'] as string[]).push(cookieStr);
        };

        await next();
    };
};
