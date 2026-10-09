// Reject encoded separators/control characters as well as literal open redirects.
export function safeNext(value: unknown): string {
    if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/')) return '/profile';
    let decoded = value;
    try {
        for (let pass = 0; pass < 4; pass++) {
            if (decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded)) return '/profile';
            const next = decodeURIComponent(decoded);
            if (next === decoded) break;
            decoded = next;
        }
        if (decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded) || /%[0-9a-f]{2}/i.test(decoded)) return '/profile';
        const url = new URL(value, 'https://app.invalid');
        if (url.origin !== 'https://app.invalid' || /^\/auth(?:\/|$)/i.test(new URL(decoded, 'https://app.invalid').pathname)) return '/profile';
        return url.pathname + url.search + url.hash;
    } catch {
        return '/profile';
    }
}
export function loginPath(next: unknown = '/profile'): string {
    return '/auth/login?next=' + encodeURIComponent(safeNext(next));
}
