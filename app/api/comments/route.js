import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId, text, authorName } = await request.json();
    if (!videoId || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use username as authorName if not provided
    const displayName = authorName || session.user.username || session.user.name || 'Anonymous';

    const comment = await prisma.comment.create({
      data: {
        videoId,
        text,
        authorName: displayName,
        userId: session.user.id, // Use string ID directly
      },
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const comments = await prisma.comment.findMany({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            username: true,
            name: true,
            image: true
          }
        }
      }
    });

    // Transform the response to include username
    const transformedComments = comments.map(comment => ({
      ...comment,
      authorName: comment.authorName || comment.user.username || comment.user.name || 'Anonymous'
    }));

    return NextResponse.json(transformedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
} 