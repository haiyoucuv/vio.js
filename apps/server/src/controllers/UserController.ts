import { Controller, Get, Post, Use, BaseContext, Param, Query, Body, Ctx, IsRequired, IsString, IsInt, Min } from 'viojs-core';
import { successMiddleware } from '../middlewares';

export class CreateUserDto {
    @IsRequired('You must provide a username!')
    @IsString('Username must be a string')
    username!: string;

    @IsRequired('Age is required for signing up')
    @IsInt('Age must be a valid integer')
    @Min(18, 'You must be at least 18 years old')
    age!: number;

    // Optional but strictly typed: ONLY validates if the user brings it.
    @IsString('Nickname must be a string if you provide it')
    nickname?: string;

    // Completely unvalidated, raw data field.
    // The framework will transparently copy whatever the client sends here.
    extraInfo?: any;
}

@Controller('/users')
@Use(successMiddleware)
export class UserController {

    @Get('/:id')
    async getUser(
        @Param('id') id: number,
        @Query('role') role: string = 'guest',
        @Ctx() ctx: BaseContext
    ) {
        // Here we test strong typing and automatic conversion (id should be Number now)
        console.log(`Extracted ID (type ${typeof id}):`, id);

        // Let's test reading a cookie! (Try setting it via the browser or Postman first)
        const visitCount = ctx.getCookie('visit_count') || '0';
        const newCount = parseInt(visitCount) + 1;

        // And setting a cookie!
        ctx.setCookie('visit_count', newCount.toString(), { maxAge: 3600, httpOnly: true });

        return {
            id,
            name: `User ${id}`,
            currentRole: role,
            visits: newCount,
            message: 'Check your cookies!'
        };
    }

    @Post('/')
    async createUser(@Body() dto: CreateUserDto) {
        console.log('@post called for createUser with valid DTO:', dto);
        return {
            status: 'success',
            username: dto.username,
            age: dto.age,
            message: 'User explicitly created and passed all validation checks!'
        };
    }
}
