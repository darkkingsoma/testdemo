import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '../../../lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('GET /api/movies - Session:', session);
    
    if (!session) {
      console.log('GET /api/movies - No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user?.id) {
      console.log('GET /api/movies - No user ID in session:', session);
      return NextResponse.json({ error: 'No user ID in session' }, { status: 401 });
    }

    console.log('GET /api/movies - Fetching movies for user:', session.user.id);

    const userMovies = await prisma.movieList.findMany({
      where: { 
        userId: session.user.id
      },
    });

    console.log('GET /api/movies - Found movies:', userMovies);

    const moviesByCategory = {
      watching: userMovies.filter(movie => 
        movie.category.toLowerCase() === 'watching'
      ),
      'will-watch': userMovies.filter(movie => 
        movie.category.toLowerCase() === 'will watch' || 
        movie.category.toLowerCase() === 'will-watch'
      ),
      'already-watched': userMovies.filter(movie => 
        movie.category.toLowerCase() === 'already watched' || 
        movie.category.toLowerCase() === 'already-watched'
      ),
    };

    return NextResponse.json(moviesByCategory);
  } catch (error) {
    console.error('GET /api/movies - Error:', error);
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('POST /api/movies - Full session:', session);
    
    if (!session) {
      console.log('POST /api/movies - No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.user) {
      console.log('POST /api/movies - No user in session');
      return NextResponse.json({ error: 'No user in session' }, { status: 401 });
    }

    const userId = session.user.id || session.user.sub;
    if (!userId) {
      console.log('POST /api/movies - No user ID in session:', session.user);
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 401 });
    }

    console.log('POST /api/movies - Session user:', session.user);
    console.log('POST /api/movies - User ID:', userId);

    const body = await request.json();
    console.log('POST /api/movies - Request body:', body);

    const { movieId, title, poster, category, overview, releaseDate, rating, votes, genreIds, description, source } = body;

    if (!movieId || !title || !category) {
      console.log('POST /api/movies - Missing required fields:', { movieId, title, category });
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: { movieId, title, category }
      }, { status: 400 });
    }

    // Map category to consistent format
    const categoryMap = {
      'Watching': 'watching',
      'Will Watch': 'will-watch',
      'Already Watched': 'already-watched',
      'watching': 'watching',
      'will watch': 'will-watch',
      'already watched': 'already-watched',
      'will-watch': 'will-watch',
      'already-watched': 'already-watched'
    };

    const normalizedCategory = categoryMap[category] || category.toLowerCase();
    console.log('POST /api/movies - Normalized category:', normalizedCategory);

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    console.log('POST /api/movies - Found user:', user);

    if (!user) {
      console.error('POST /api/movies - User not found:', userId);
      return NextResponse.json({ 
        error: 'User not found',
        details: 'The user associated with this session does not exist',
        userId: userId
      }, { status: 404 });
    }

    // Check if movie already exists in user's list
    const existingMovie = await prisma.movieList.findFirst({
      where: {
        userId: userId,
        movieId: movieId.toString(),
      },
    });

    console.log('POST /api/movies - Existing movie check:', existingMovie);

    if (existingMovie) {
      console.log('POST /api/movies - Updating existing movie:', existingMovie.id);
      const updatedMovie = await prisma.movieList.update({
        where: { id: existingMovie.id },
        data: { category: normalizedCategory },
      });
      console.log('POST /api/movies - Updated movie:', updatedMovie);
      return NextResponse.json(updatedMovie);
    }

    const movieData = {
      userId: userId,
      movieId: movieId.toString(),
      title: title.substring(0, 191),
      poster: poster?.substring(0, 191) || '',
      category: normalizedCategory,
      overview: (overview || '').substring(0, 191),
      releaseDate: (releaseDate || '').substring(0, 191),
      rating: (rating || 'N/A').substring(0, 191),
      votes: (votes || '0').substring(0, 191),
      genreIds: typeof genreIds === 'string' ? genreIds.substring(0, 191) : '[]',
      description: (description || '').substring(0, 191),
      source: source || 'tmdb'
    };

    console.log('POST /api/movies - Creating new movie with data:', movieData);

    const movie = await prisma.movieList.create({
      data: movieData
    });

    console.log('POST /api/movies - Created new movie:', movie);
    return NextResponse.json(movie);
  } catch (error) {
    console.error('POST /api/movies - Error:', error);
    console.error('POST /api/movies - Error stack:', error.stack);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}