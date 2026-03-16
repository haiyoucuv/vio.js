import { Injectable } from 'viojs-core';

@Injectable()
export class AuthService {

    // In a real app, this would check DB or Redis based on user session
    public async getUnlockedAnimations(userId: string): Promise<string[]> {
        // Mock data logic
        console.log(`[AuthService] Fetching unlocked animations for user ${userId}...`);

        if (userId === 'VIP') {
            return ['walk', 'jump', 'roar', 'fly', 'attack'];
        }
        return ['walk', 'jump']; // Basic users
    }

    public validateToken(token: string): boolean {
        return token.startsWith('valid_');
    }
}
