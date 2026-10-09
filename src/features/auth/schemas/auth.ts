import { z } from 'zod';

const fields = z.object({
    email: z.string().trim().max(254).email('Enter a valid email address.'),
    password: z.string().min(1, 'Enter your password.').max(128, 'Use at most 128 characters.'),
    displayName: z.string().trim().max(80, 'Use at most 80 characters.'),
    confirmPassword: z.string().max(128),
});
export const loginSchema = fields;
export const signUpSchema = fields.superRefine((value, context) => {
    if (!value.displayName || /[\u0000-\u001f\u007f]/.test(value.displayName)) {
        context.addIssue({ code: 'custom', path: ['displayName'], message: 'Enter a display name using 1–80 characters.' });
    }
    if (value.password.length < 6) {
        context.addIssue({ code: 'custom', path: ['password'], message: 'Use at least 6 characters. A longer password is safer.' });
    }
    if (value.password !== value.confirmPassword) {
        context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords must match.' });
    }
});
export type AuthValues = z.infer<typeof loginSchema>;
