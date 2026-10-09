import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// The database trigger owns profile creation. Never insert or upsert a second profile.
export async function initializeDisplayName(supabase: Awaited<ReturnType<typeof createClient>>, user: User) {
    const candidate: unknown = user.user_metadata?.display_name ?? user.user_metadata?.full_name;
    if (typeof candidate !== 'string') return;
    const name = candidate.trim();
    if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) return;
    const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', user.id).is('display_name', null);
    if (error) throw new Error('Profile initialization unavailable.');
}
