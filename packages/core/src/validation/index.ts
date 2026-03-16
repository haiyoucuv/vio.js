import 'reflect-metadata';

export const VALIDATION_METADATA_KEY = 'VIO:VALIDATION';

export interface ValidationRule {
    property: string;
    type: string;
    value?: any;
    message?: string;
}

function addValidationRule(target: any, propertyKey: string, rule: Omit<ValidationRule, 'property'>) {
    const rules: ValidationRule[] = Reflect.getMetadata(VALIDATION_METADATA_KEY, target.constructor) || [];
    rules.push({ property: propertyKey, ...rule });
    Reflect.defineMetadata(VALIDATION_METADATA_KEY, rules, target.constructor);
}

// Validation Error Exception class
export class ValidationError extends Error {
    constructor(public errors: string[]) {
        super(errors.join(' | ')); // Joined by pipe for error message output
        this.name = 'ValidationError';
    }
}

// Built-in Validation Property Decorators
export function IsRequired(message?: string): PropertyDecorator {
    return (target, propertyKey) => addValidationRule(target, propertyKey as string, { type: 'required', message });
}
export function IsString(message?: string): PropertyDecorator {
    return (target, propertyKey) => addValidationRule(target, propertyKey as string, { type: 'string', message });
}
export function IsNumber(message?: string): PropertyDecorator {
    return (target, propertyKey) => addValidationRule(target, propertyKey as string, { type: 'number', message });
}
export function IsInt(message?: string): PropertyDecorator {
    return (target, propertyKey) => addValidationRule(target, propertyKey as string, { type: 'int', message });
}
export function IsBoolean(message?: string): PropertyDecorator {
    return (target, propertyKey) => addValidationRule(target, propertyKey as string, { type: 'boolean', message });
}
export function Min(val: number, message?: string): PropertyDecorator {
    return (target, propertyKey) => addValidationRule(target, propertyKey as string, { type: 'min', value: val, message });
}
export function Max(val: number, message?: string): PropertyDecorator {
    return (target, propertyKey) => addValidationRule(target, propertyKey as string, { type: 'max', value: val, message });
}

// High performance native DTO Validator Engine
export function validateDTO(dtoClass: any, plainObject: any): any {
    const rules: ValidationRule[] = Reflect.getMetadata(VALIDATION_METADATA_KEY, dtoClass) || [];
    
    // No decorators, immediately return transparent wrapper
    if (rules.length === 0) {
        if (plainObject && typeof plainObject === 'object') {
            const temp = new dtoClass();
            Object.assign(temp, plainObject);
            return temp;
        }
        return plainObject;
    }

    const errors: string[] = [];
    const instance = new dtoClass();
    
    // Copy arbitrary fields ignoring safety for now to support nested objects
    if (plainObject && typeof plainObject === 'object') {
        Object.assign(instance, plainObject);
    }
    
    for (const rule of rules) {
        const val = instance[rule.property];
        const isMissing = (val === undefined || val === null || val === '');
        
        if (rule.type === 'required' && isMissing) {
            errors.push(rule.message || `Parameter [${rule.property}] is required.`);
            continue;
        }
        
        if (!isMissing) {
            if (rule.type === 'string' && typeof val !== 'string') {
                errors.push(rule.message || `Parameter [${rule.property}] must be a valid string.`);
            } else if (rule.type === 'number') {
                const num = Number(val);
                if (isNaN(num)) errors.push(rule.message || `Parameter [${rule.property}] must be a number.`);
                else instance[rule.property] = num;
            } else if (rule.type === 'int') {
                const num = Number(val);
                if (isNaN(num) || !Number.isInteger(num)) errors.push(rule.message || `Parameter [${rule.property}] must be an integer.`);
                else instance[rule.property] = num;
            } else if (rule.type === 'boolean') {
                if (val !== 'true' && val !== 'false' && val !== true && val !== false && val !== 1 && val !== 0 && val !== '1' && val !== '0') {
                    errors.push(rule.message || `Parameter [${rule.property}] must be a boolean.`);
                } else instance[rule.property] = (val === 'true' || val === '1' || val === true || val === 1);
            } else if (rule.type === 'min') {
                if (Number(val) < rule.value) errors.push(rule.message || `Parameter [${rule.property}] must be >= ${rule.value}.`);
            } else if (rule.type === 'max') {
                 if (Number(val) > rule.value) errors.push(rule.message || `Parameter [${rule.property}] must be <= ${rule.value}.`);
            }
        }
    }
    
    if (errors.length > 0) {
        throw new ValidationError(errors);
    }
    
    return instance; // Cleanly parsed and casted Data Transfer Object (DTO)
}
