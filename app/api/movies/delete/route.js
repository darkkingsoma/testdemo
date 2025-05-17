import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { movieId, category } = await request.json();
    if (!movieId || !category) {
      return NextResponse.json({ error: 'Movie ID and category are required' }, { status: 400 });
    }

    console.log('Deleting movie:', { movieId, category, userId: session.user.id });

    // Delete the movie from the user's list
    const deletedMovie = await prisma.movieList.deleteMany({
      where: {
        userId: session.user.id,
        movieId: movieId.toString(),
        category: category
      }
    });

    console.log('Deleted movie result:', deletedMovie);

    if (deletedMovie.count === 0) {
      return NextResponse.json({ error: 'Movie not found in list' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Movie removed from list', deleted: deletedMovie });
  } catch (error) {
    console.error('Delete movie error:', error);
    return NextResponse.json({ error: 'Failed to remove movie from list' }, { status: 500 });
  }
} 