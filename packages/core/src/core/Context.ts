export type Next = () => Promise<void>;
export type Middleware<TContext extends BaseContext = BaseContext> = (ctx: TContext, next: Next) => Promise<void>;

import { HttpResponse } from 'uWebSockets.js';

export class BaseContext {
    res: HttpResponse;
    aborted: boolean = false;
    responded: boolean = false; // Tracks if response has been sent to uWebSockets

    // Request properties
    method: string;
    url: string;
    query: string;
    headers: Record<string, string>;
    params: Record<string, string> = {};

    // Response properties
    body: any;
    status: number = 200;
    responseHeaders: Record<string, string | string[]> = {};

    // File streaming properties
    _filePath?: string;

    private bodyPromise: Promise<Buffer>;

    constructor(res: HttpResponse, reqData: { method: string, url: string, query: string, headers: Record<string, string> }) {
        this.res = res;
        this.method = reqData.method;
        this.url = reqData.url;
        this.query = reqData.query;
        this.headers = reqData.headers;

        res.onAborted(() => {
            this.aborted = true;
        });

        const contentLength = this.headers['content-length'];
        const transferEncoding = this.headers['transfer-encoding'];
        const hasBody = (contentLength && parseInt(contentLength) > 0) || (transferEncoding && transferEncoding.includes('chunked'));

        if (hasBody) {
            this.bodyPromise = new Promise((resolve) => {
                let buffer: Buffer;
                res.onData((chunk, isLast) => {
                    const chunkBuffer = Buffer.from(chunk);
                    if (isLast) {
                        if (buffer) {
                            resolve(Buffer.concat([buffer, chunkBuffer]));
                        } else {
                            resolve(chunkBuffer);
                        }
                    } else {
                        if (buffer) {
                            buffer = Buffer.concat([buffer, chunkBuffer]);
                        } else {
                            buffer = chunkBuffer;
                        }
                    }
                });
            });
        } else {
            this.bodyPromise = Promise.resolve(Buffer.alloc(0));
        }
    }

    // Helper to read body (async because we might need to buffer)
    async json(): Promise<any> {
        const buffer = await this.bodyPromise;
        if (!buffer || buffer.length === 0) return {};
        try {
            return JSON.parse(buffer.toString());
        } catch (e) {
            return {};
        }
    }

    async text(): Promise<string> {
        const buffer = await this.bodyPromise;
        return buffer ? buffer.toString() : '';
    }

    // Lazy initialization for query parameters
    private _parsedQuery?: Record<string, string>;
    public get queries(): Record<string, string> {
        if (!this._parsedQuery) {
            this._parsedQuery = {};
            if (this.query) {
                const searchParams = new URLSearchParams(this.query);
                for (const [key, value] of searchParams.entries()) {
                    this._parsedQuery[key] = value;
                }
            }
        }
        return this._parsedQuery;
    }

    // --- Cookie Support ---
    private _cookies?: Record<string, string>;
    public get cookies(): Record<string, string> {
        if (!this._cookies) {
            this._cookies = {};
            const cookieHeader = this.headers['cookie'];
            if (cookieHeader) {
                cookieHeader.split(';').forEach(part => {
                    const [key, value] = part.split('=');
                    if (key && value) this._cookies![key.trim()] = decodeURIComponent(value.trim());
                });
            }
        }
        return this._cookies;
    }

    public getCookie(name: string): string | undefined {
        return this.cookies[name];
    }

    public setCookie(name: string, value: string, options: { maxAge?: number, path?: string, httpOnly?: boolean, secure?: boolean, domain?: string, sameSite?: 'Strict' | 'Lax' | 'None' } = {}) {
        let str = `${name}=${encodeURIComponent(value)}`;
        if (options.maxAge) str += `; Max-Age=${options.maxAge}`;
        if (options.path) str += `; Path=${options.path}`; else str += `; Path=/`;
        if (options.domain) str += `; Domain=${options.domain}`;
        if (options.httpOnly) str += `; HttpOnly`;
        if (options.secure) str += `; Secure`;
        if (options.sameSite) str += `; SameSite=${options.sameSite}`;
        
        const existing = this.responseHeaders['Set-Cookie'];
        if (Array.isArray(existing)) {
            existing.push(str);
        } else if (existing) {
            this.responseHeaders['Set-Cookie'] = [existing, str];
        } else {
            this.responseHeaders['Set-Cookie'] = str;
        }
    }

    public throw(status: number, message?: string): never {
        this.status = status;
        throw new Error(message || `Error ${status}`);
    }

    public redirect(url: string, status: number = 302): void {
        this.status = status;
        this.responseHeaders['Location'] = url;
        this.body = '';
    }

    public sendFile(path: string): void {
        this._filePath = path;
    }
}
