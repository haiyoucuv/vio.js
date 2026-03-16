import 'reflect-metadata';
import { INJECTABLE_METADATA } from '../decorators';

export class Container {
    public instances = new Map<any, any>();

    resolve<T>(target: any): T {
        // Find if target has been marked as injectable (explicitly or via Controller)
        const isInjectable = Reflect.getMetadata(INJECTABLE_METADATA, target) || target.name !== 'Object';

        if (!isInjectable) {
            throw new Error(`Cannot resolve ${target.name || target}. Make sure it has @Injectable() or @Controller() decorator.`);
        }

        // Return singleton if already instantiated
        if (this.instances.has(target)) {
            return this.instances.get(target);
        }

        // Check constructor dependencies
        const tokens = Reflect.getMetadata('design:paramtypes', target) || [];
        
        let injections: any[] = [];
        if (tokens.length > 0) {
            injections = tokens.map((token: any) => {
                // Circular dependency or undefined typescript output guard
                if (!token || token === target) {
                    throw new Error(`Failed to resolve dependencies for ${target.name}. Circular dependency detected or bad type.`);
                }
                return this.resolve<any>(token);
            });
        }

        // Instantiate
        const instance = new target(...injections);
        this.instances.set(target, instance);

        return instance;
    }
}

export const container = new Container();
