import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '../../../lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Log the session to debug
    console.log('Session user:', session.user);

    const userMovies = await prisma.movieList.findMany({
      where: { 
        userId: session.user.id // No need to parse as integer anymore
      },
    });

    // Log the found movies to debug
    console.log('Found movies:', userMovies);

    // Normalize categories for comparison
    const moviesByCategory = {
      watching: userMovies.filter(movie => 
        movie.category.toLowerCase() === 'watching' || 
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
    console.error('Error fetching movies:', error);
    return NextResponse.json({ error: 'Failed to fetch movies' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log('No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Session user:', session.user);

    const body = await request.json();
    console.log('Raw request body:', body);

    const { movieId, title, poster, category, overview, releaseDate, rating, votes, genreIds, description, source } = body;

    console.log('Parsed movie data:', { 
      movieId, 
      title, 
      category, 
      source,
      userId: session.user.id 
    });

    if (!movieId || !title || !category) {
      console.log('Missing required fields:', { movieId, title, category });
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
    console.log('Normalized category:', normalizedCategory);

    // Use userId directly as string
    const userId = session.user.id;
    if (!userId) {
      console.error('Invalid userId:', session.user.id);
      return NextResponse.json({ 
        error: 'Invalid user ID',
        details: 'User ID is required'
      }, { status: 400 });
    }

    // Check if movie already exists in user's list
    const existingMovie = await prisma.movieList.findFirst({
      where: {
        userId: userId,
        movieId: movieId.toString(),
      },
    });

    console.log('Existing movie check:', existingMovie);

    if (existingMovie) {
      console.log('Updating existing movie:', existingMovie.id);
      // Update the category if the movie already exists
      const updatedMovie = await prisma.movieList.update({
        where: { id: existingMovie.id },
        data: { category: normalizedCategory },
      });
      console.log('Updated movie:', updatedMovie);
      return NextResponse.json(updatedMovie);
    }

    console.log('Creating new movie entry with data:', {
      userId,
      movieId: movieId.toString(),
      title: title.substring(0, 191),
      poster: poster.substring(0, 191),
      category: normalizedCategory,
      overview: (overview || '').substring(0, 191),
      releaseDate: (releaseDate || '').substring(0, 191),
      rating: (rating || 'N/A').substring(0, 191),
      votes: (votes || '0').substring(0, 191),
      genreIds: typeof genreIds === 'string' ? genreIds.substring(0, 191) : '[]',
      description: (description || '').substring(0, 191),
      source: source || 'tmdb'
    });

    // Create new movie entry
    const movie = await prisma.movieList.create({
      data: {
        userId: userId,
        movieId: movieId.toString(),
        title: title.substring(0, 191),
        poster: poster.substring(0, 191),
        category: normalizedCategory,
        overview: (overview || '').substring(0, 191),
        releaseDate: (releaseDate || '').substring(0, 191),
        rating: (rating || 'N/A').substring(0, 191),
        votes: (votes || '0').substring(0, 191),
        genreIds: typeof genreIds === 'string' ? genreIds.substring(0, 191) : '[]',
        description: (description || '').substring(0, 191),
        source: source || 'tmdb'
      },
    });

    console.log('Created new movie:', movie);
    return NextResponse.json(movie);
  } catch (error) {
    console.error('Error adding movie:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: 'Failed to add movie',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}