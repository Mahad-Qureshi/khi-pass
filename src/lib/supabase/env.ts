import { z } from 'zod';

const supabaseEnvSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().refine((value) => {
        const url = new URL(value);
        return (
            !url.username && !url.password && !url.search && !url.hash &&
            (url.protocol === 'https:' ||
                (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
        );
    }),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
});

export class SupabaseConfigurationError extends Error {
    constructor(variables: string[]) {
        super(`Missing or invalid Supabase configuration: ${variables.join(', ')}. Use a public publishable key.`);
        this.name = 'SupabaseConfigurationError';
    }
}

export function getSupabaseEnv() {
    // Explicit references allow Next.js to inline these public values in browser bundles.
    const result = supabaseEnvSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });

    if (!result.success) {
        throw new SupabaseConfigurationError(
            [...new Set(result.error.issues.map((issue) => String(issue.path[0])))],
        );
    }

    return {
        url: result.data.NEXT_PUBLIC_SUPABASE_URL,
        publishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    };
}
