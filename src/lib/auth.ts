import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getMe, type UserDto } from './api-client';

// Backend uses 'jwt_token' cookie name
const COOKIE_NAME = 'jwt_token';

export interface AuthPayload {
  role: 'Admin' | 'User';
  userId?: string;
}

/**
 * Get token from cookies (for server components/API routes)
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Get token from request (for middleware)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}

/**
 * Get auth cookie options for setting HttpOnly cookie
 * Backend sets the cookie, but we can use this for clearing
 */
export function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as 'none' | 'lax' | 'strict',
    maxAge: 60 * 60 * 24, // 24 hours in seconds
    path: '/',
  };
}

/**
 * Clear auth cookie (for logout)
 */
export function clearAuthCookie() {
  const options = getAuthCookieOptions();
  
  const cookieParts = [
    `${options.name}=`,
    'Max-Age=0',
    `Path=${options.path}`,
    options.httpOnly ? 'HttpOnly' : '',
    options.secure ? 'Secure' : '',
    `SameSite=${options.sameSite}`,
  ].filter(Boolean);
  
  return cookieParts.join('; ');
}

/**
 * Get token from request (for middleware)
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}

/**
 * Get token from cookies (for server components/API routes)
 */
export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

/**
 * Verify authentication by calling backend /api/auth/me
 * Returns user info if authenticated, null otherwise
 */
export async function verifyAuth(): Promise<UserDto | null> {
  try {
    const response = await getMe();
    if (response.data && response.statusCode === 200) {
      return response.data;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await verifyAuth();
  return user?.role === 'Admin';
}

/**
 * Verify user authentication from cookies
 */
export async function verifyUserAuth(): Promise<AuthPayload | null> {
  const user = await verifyAuth();
  if (!user) return null;
  
  return {
    role: user.role as 'Admin' | 'User',
    userId: user.id,
  };
}

/**
 * Get current user ID from backend
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await verifyAuth();
  return user?.id || null;
}

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<UserDto | null> {
  return await verifyAuth();
}
