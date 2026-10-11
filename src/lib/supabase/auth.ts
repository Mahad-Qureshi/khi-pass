import 'server-only';

import { isAuthSessionMissingError, type User } from '@supabase/supabase-js';
import { connection } from 'next/server';

import { createClient } from './server';

export class AuthenticationRequiredError extends Error {
    readonly code = 'UNAUTHENTICATED';
    readonly status = 401;

    constructor() {
        super('Authentication required.');
        this.name = 'AuthenticationRequiredError';
    }
}

export class AuthenticationVerificationError extends Error {
    readonly code = 'AUTH_VERIFICATION_UNAVAILABLE';
    readonly status = 503;

    constructor() {
        super('Unable to verify authentication. Try again later.');
        this.name = 'AuthenticationVerificationError';
    }
}

// Never cache this result across requests or use the cookie's embedded user as identity.
export async function getAuthenticatedUser(): Promise<User | null> {
    // Supabase checks session expiry against the current time; identity must run per request.
    await connection();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
        if (isAuthSessionMissingError(error) || error.status === 401 || error.status === 403 ||
            ['bad_jwt', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error.code ?? '')) {
            return null;
        }
        throw new AuthenticationVerificationError();
    }

    return data.user;
}

export async function requireAuthenticatedUser(): Promise<User> {
    const user = await getAuthenticatedUser();
    if (!user) throw new AuthenticationRequiredError();
    return user;
}
