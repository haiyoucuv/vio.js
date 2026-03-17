import { Controller, Get, Post, Param, Query, Body, Ctx, Cookie, IsRequired, IsString, IsInt, Min, BaseContext } from 'viojs-core';

/**
 * Data Transfer Object for User Creation
 * Demonstrates the built-in validation system.
 */
export class CreateUserDto {
    @IsRequired('Username is required')
    @IsString('Username must be a string')
    username!: string;

    @IsRequired('Age is required')
    @IsInt('Age must be an integer')
    @Min(18, 'Must be at least 18 years old')
    age!: number;

    @IsString('Alternative bio')
    bio?: string;
}

@Controller('/api/v1/users')
export class UserController {

    /**
     * GET /api/v1/users/:id
     * Demonstrates: Route Parameters, Query Parameters, and Cookie Injection
     */
    @Get('/:id')
    async getUser(
        @Param('id') id: number,
        @Ctx() ctx: BaseContext,
        @Query('detail') detail: boolean = false,
        @Cookie('last_visit') lastVisit?: string,
    ) {
        // Set a cookie for next time using the built-in method
        const now = new Date().toISOString();
        ctx.setCookie('last_visit', now, { maxAge: 3600, httpOnly: true });

        return {
            info: "Extracted from Vio.js Context",
            timestamp: now,
            data: {
                id,
                type: typeof id, // Demonstrates automatic type conversion
                requestedDetail: detail,
                previousVisit: lastVisit || 'First time!'
            }
        };
    }

    /**
     * POST /api/v1/users
     * Demonstrates: Body parsing and Automatic DTO Validation
     */
    @Post('/')
    async createUser(@Body() dto: CreateUserDto) {
        return {
            message: "User validated and created successfully",
            echo: dto,
            tip: "Try sending invalid data to see the error responses"
        };
    }
}
