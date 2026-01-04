import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/api-client';

/**
 * Get user info by IDs (for admin)
 * Accepts array of user IDs and returns user info map
 * Proxy to backend /api/admin/users/{id}
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User IDs array is required' },
        { status: 400 }
      );
    }

    // Fetch user info for each ID
    const userMap: Record<string, any> = {};
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        const response = await getUser(userId);
        if (response.data) {
          // Map backend UserResponseDto to frontend format
          userMap[userId] = {
            id: response.data.id,
            name: response.data.name,
            email: response.data.email,
            role: response.data.role,
          };
        }
      } catch (error: any) {
        // Silently skip errors for individual users
        console.error(`Failed to fetch user ${userId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      users: userMap,
    });
  } catch (error: any) {
    console.error('Get users info error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

