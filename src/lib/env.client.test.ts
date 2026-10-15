import {describe, expect, it} from 'vitest';
import {publicEnvSchema} from './env.client';

describe('public environment configuration', () => {
  it('defaults the app URL and permits unset optional Supabase settings', () => {
    expect(publicEnvSchema.parse({})).toEqual({NEXT_PUBLIC_APP_URL: 'http://localhost:3000'});
    expect(publicEnvSchema.parse({NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ''}))
      .toEqual({NEXT_PUBLIC_APP_URL: 'http://localhost:3000'});
  });

  it('accepts public Supabase settings while excluding secret keys', () => {
    const parsed = publicEnvSchema.parse({
      NEXT_PUBLIC_APP_URL: 'https://maison.example',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      SUPABASE_SECRET_KEY: 'must-not-be-exposed',
    });
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe('https://project.supabase.co');
    expect(parsed).not.toHaveProperty('SUPABASE_SECRET_KEY');
  });

  it('rejects malformed public URLs', () => {
    expect(() => publicEnvSchema.parse({NEXT_PUBLIC_SUPABASE_URL: 'not a url'})).toThrow();
  });
});
