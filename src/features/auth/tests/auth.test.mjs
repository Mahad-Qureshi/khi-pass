import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginSchema, signUpSchema } from '../schemas/auth.ts';
import { safeNext, loginPath } from '../redirect.ts';

test('redirects allow only internal application destinations', () => {
    for (const path of ['/profile', '/', '/places?area=dha#details', '/profile?x=1']) assert.equal(safeNext(path), path);
    for (const path of [undefined, null, 4, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/%5cevil.example', '/%2f%2fevil.example',
        '/%252f%252fevil.example', '/%0d%0aLocation:evil', '/ profile', 'javascript:alert(1)', 'data:text/html,a', '/auth/callback', '/x/../auth/login', '/%2e%2e/auth/login', '/%zz', '/' + 'a'.repeat(2048)]) {
        assert.equal(safeNext(path), '/profile', String(path));
    }
});
test('protected routes encode login destinations and reject external next', () => {
    assert.equal(loginPath('/profile'), '/auth/login?next=%2Fprofile');
    assert.equal(loginPath('//evil.example'), '/auth/login?next=%2Fprofile');
});
test('login validates email and password without applying signup policy to existing accounts', () => {
    const valid={email:'person@example.com',password:'short',displayName:'',confirmPassword:''};
    assert.equal(loginSchema.safeParse(valid).success,true);
    for(const change of [{email:'invalid'},{password:''},{password:'a'.repeat(129)}]) assert.equal(loginSchema.safeParse({...valid,...change}).success,false);
});
test('signup enforces display name, confirmed password and hosted minimum policy', () => {
    const valid={email:'person@example.com',password:'Long-test-password!',confirmPassword:'Long-test-password!',displayName:' Local user '};
    assert.equal(signUpSchema.parse(valid).displayName,'Local user');
    for(const change of [{displayName:''},{displayName:'x'.repeat(81)},{displayName:'name\ncontrol'},{password:'12345',confirmPassword:'12345'},{confirmPassword:'different'}]) {
        assert.equal(signUpSchema.safeParse({...valid,...change}).success,false);
    }
});
