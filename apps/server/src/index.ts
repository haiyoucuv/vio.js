import { Application } from 'viojs-core';
import { UserController } from './controllers/UserController';
import { GameSocketController } from './controllers/GameSocketController';
import { errorMiddleware } from './middlewares';
import { cookie, staticFiles } from 'viojs-middlewares';
import * as path from 'path';

async function main() {
    const app = new Application();

    // Global middleware for error handling
    app.use(errorMiddleware);
    app.use(cookie());

    // Serve static files
    const publicDir = path.join(__dirname, 'public');
    app.use(staticFiles(publicDir, { maxAge: 86400 }));

    // Optional: Home route redirect to test page
    app.use(async (ctx, next) => {
        if (ctx.url === '/') {
            ctx.redirect('/index.html');
            return;
        }
        await next();
    });

    // Middleware example
    app.use(async (ctx, next) => {
        const start = Date.now();
        console.log(`[${ctx.method}] ${ctx.url} - processing`);
        await next();
        const ms = Date.now() - start;
        console.log(`[${ctx.method}] ${ctx.url} - ${ms}ms`);
    });

    // Register controllers
    app.registerRoutes([UserController, GameSocketController]);

    const PORT = 3001;
    await app.listen(PORT, (token) => {
        if (token) {
            console.log(`Server listening on http://localhost:${PORT}`);
        } else {
            console.error(`Failed to listen on port ${PORT}`);
        }
    });
}

main().catch(console.error);
