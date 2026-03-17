import 'reflect-metadata';
import { Application } from 'viojs-core';
import { UserController } from './controllers/UserController';
import { GameSocketController } from './controllers/GameSocketController';

const app = new Application();

// Enhanced CORS Middleware (Supports Credentials/Cookies)
app.use(async (ctx, next) => {
    const origin = ctx.headers['origin'] || '*';
    ctx.responseHeaders['Access-Control-Allow-Origin'] = origin;
    ctx.responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    ctx.responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cookie';
    ctx.responseHeaders['Access-Control-Allow-Credentials'] = 'true';
    
    if (ctx.method === 'OPTIONS') {
        ctx.status = 204;
        ctx.body = '';
        return;
    }
    await next();
});

// Logging Middleware
app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    console.log(`${ctx.method} ${ctx.url} - ${Date.now() - start}ms`);
});

// Register Controllers
app.registerRoutes([
    UserController,
    GameSocketController
]);

app.listen(3001, (token) => {
    if (token) {
        console.log('🚀 Vio.js Server running on http://localhost:3001');
    }
});
