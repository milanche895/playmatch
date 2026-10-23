import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import type { User } from '@/types';
import { connectDb } from '@/server/db';
import { getRequiredSecret } from '@/server/utils/secrets';
import UserModel from '@/server/models/User';

type SessionDoc = {
  emailVerified?: boolean;
  provider?: string;
};

function emailVerifiedFlag(user: SessionDoc): boolean {
  if (user.emailVerified) return true;
  return Boolean(user.provider && user.provider !== 'local');
}

/**
 * User snapshot for the first server render. The browser hydrates against this
 * HTML, so the nav must not wait for a client /api/auth/me round-trip.
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;

    let payload: jwt.JwtPayload | string;
    try {
      payload = jwt.verify(token, getRequiredSecret('JWT_SECRET', 'dev_secret'));
    } catch {
      return null;
    }

    const userId = typeof payload === 'object' && payload ? payload.id : null;
    if (!userId || typeof userId !== 'string') return null;

    await connectDb();
    const doc = await UserModel.findById(userId)
      .select(
        '-password -emailVerifyTokenHash -emailVerifyExpires -emailVerifySentAt -providerData -pushSubscription'
      )
      .lean();
    if (!doc) return null;

    const plain = JSON.parse(JSON.stringify(doc)) as User;
    plain.emailVerified = emailVerifiedFlag(plain);
    return plain;
  } catch (err) {
    console.error('Failed to read session user:', err);
    return null;
  }
}
