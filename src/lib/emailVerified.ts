import { User } from '../types';

export function isEmailVerified(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.emailVerified) return true;
  return Boolean(user.provider && user.provider !== 'local');
}

/** Once verified, never let a stale /me response flip the flag back to false. */
export function mergeAuthUser(prev: User | null, next: User | null): User | null {
  if (!next) return next;
  if (prev?.emailVerified && !next.emailVerified) {
    return { ...next, emailVerified: true };
  }
  return next;
}
