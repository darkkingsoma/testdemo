'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import Image from 'next/image';
import Footer from '../../components/Footer';

export default function MovieDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { id } = useParams();
  
  // Initialize state with default values
  const [movie, setMovie] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('trailer');
  const [streamError, setStreamError] = useState(null);
  const [selectedList, setSelectedList] = useState('');
  const [error, setError] = useState('');
  const [cast, setCast] = useState([]);
  const [tmdbComments, setTmdbComments] = useState([]);
  const [imdbId, setImdbId] = useState(null);
  const [showAddToList, setShowAddToList] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  // Add refs for scroll navigation
  const homeRef = useRef(null);
  const popularRef = useRef(null);
  const topRatedRef = useRef(null);
  const upcomingRef = useRef(null);
  const localMoviesRef = useRef(null);
  const watchingRef = useRef(null);
  const watchLaterRef = useRef(null);
  const alreadyWatchedRef = useRef(null);

  // Get source and category from URL parameters with proper initialization
  const source = searchParams?.get('source') || 'tmdb';
  const category = searchParams?.get('category');

  const vidSrcUrl = imdbId
    ? `https://vidsrc.to/embed/movie/${imdbId}`
    : `https://vidsrc.to/embed/movie/${encodeURIComponent(movie?.title?.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').toLowerCase() || '')}`;

  // New state for user's movie lists
  const [userLists, setUserLists] = useState([]);
  const [movieInList, setMovieInList] = useState(null);

  const fetchData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError('');
    try {
      if (source === 'tmdb') {
        const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
        if (!TMDB_API_KEY) {
          throw new Error('TMDB API key is not configured. Please add NEXT_PUBLIC_TMDB_API_KEY to your .env.local file.');
        }

        // Fetch movie details
        const movieRes = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}`);
        if (!movieRes.ok) {
          const errorData = await movieRes.json().catch(() => ({}));
          throw new Error(errorData.status_message || `Failed to fetch movie data: ${movieRes.statusText}`);
        }
        const movieData = await movieRes.json();
        if (!movieData || !movieData.id) {
          throw new Error('Invalid movie data received');
        }
        setMovie(movieData);

        // Fetch videos (trailers)
        const videosRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_API_KEY}`);
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          const trailer = videosData.results?.find(video => video.type === 'Trailer');
          if (trailer) {
            setTrailerUrl(`https://www.youtube.com/embed/${trailer.key}?autoplay=1`);
          }
        }

        // Fetch external IDs (for IMDB)
        const externalIdsRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/external_ids?api_key=${TMDB_API_KEY}`);
        if (externalIdsRes.ok) {
          const externalIdsData = await externalIdsRes.json();
          setImdbId(externalIdsData.imdb_id || null);
        }

        // Fetch credits (cast)
        const creditsRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${TMDB_API_KEY}`);
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          setCast(creditsData.cast?.slice(0, 10) || []);
        }

        // Fetch reviews
        const reviewsRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/reviews?api_key=${TMDB_API_KEY}`);
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setTmdbComments(reviewsData.results || []);
        }
      } else if (source === 'youtube') {
        if (!YOUTUBE_API_KEY) {
          throw new Error('YouTube API key is not configured. Please add NEXT_PUBLIC_YOUTUBE_API_KEY to your .env.local file.');
        }

        // Handle YouTube video
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${id}&key=${YOUTUBE_API_KEY}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to fetch video details');
        }
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
          throw new Error('Video not found');
        }

        const video = data.items[0];
        const thumbnailUrl = video.snippet.thumbnails.maxres?.url || 
                           video.snippet.thumbnails.high?.url || 
                           video.snippet.thumbnails.medium?.url || 
                           video.snippet.thumbnails.default?.url;

        setMovie({
          id: video.id,
          title: video.snippet.title,
          overview: video.snippet.description,
          poster_path: thumbnailUrl,
          backdrop_path: thumbnailUrl,
          release_date: video.snippet.publishedAt,
          vote_average: calculateRating(video.statistics),
          vote_count: video.statistics.viewCount,
          source: 'youtube',
          videoId: video.id,
          channelTitle: video.snippet.channelTitle,
          likeCount: video.statistics.likeCount,
          commentCount: video.statistics.commentCount,
          duration: parseYouTubeDuration(video.contentDetails.duration),
          genres: [{ id: 'youtube', name: 'YouTube' }],
          runtime: parseYouTubeDuration(video.contentDetails.duration)
        });

        // Set trailer URL for YouTube videos
        setTrailerUrl(`https://www.youtube.com/embed/${video.id}?autoplay=1`);

        // Fetch comments
        try {
          const commentsResponse = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${id}&key=${YOUTUBE_API_KEY}&maxResults=10`);
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            const formattedComments = commentsData.items?.map(item => ({
              id: item.id,
              text: item.snippet.topLevelComment.snippet.textDisplay,
              authorName: item.snippet.topLevelComment.snippet.authorDisplayName,
              createdAt: item.snippet.topLevelComment.snippet.publishedAt,
              likeCount: item.snippet.topLevelComment.snippet.likeCount
            })) || [];
            setComments(formattedComments);
          }
        } catch (error) {
          console.error('Error fetching YouTube comments:', error);
          // Don't set error state for comments failure, just log it
        }
      }
    } catch (error) {
      console.error('Error fetching movie data:', error);
      setError(error.message || 'An error occurred while loading the movie');
      setMovie(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, source, YOUTUBE_API_KEY]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!id) return;
      
      try {
        const response = await fetch(`/api/comments?videoId=${id}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch comments');
        }
        const data = await response.json();
        if (Array.isArray(data)) {
          setComments(data);
        } else {
          console.error('Invalid comments data received:', data);
          setComments([]);
        }
      } catch (error) {
        console.error('Error fetching comments:', error);
        setError('Failed to load comments. Please try again later.');
      }
    };

    if (id && showComments) {
      fetchComments();
    }
  }, [id, showComments]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !session?.user) return;

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: id,
          text: newComment,
          authorName: session.user.username || session.user.name
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to post comment');
      }
      
      const comment = await response.json();
      if (comment && comment.id) {
        setComments(prev => [comment, ...prev]);
        setNewComment('');
        setError('');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      setError(error.message || 'Failed to post comment. Please try again later.');
    }
  };

  const handleViewToggle = () => {
    setViewMode(viewMode === 'trailer' ? 'stream' : 'trailer');
    setStreamError(null);
  };

  const handleIframeError = () => {
    setStreamError('This media is unavailable at the moment. Try again later or check if the movie is available on VidSrc.');
  };

  const handleAddToList = async (listType) => {
    if (!session) {
      setError('Please sign in to add movies to your list');
      return;
    }

    try {
      const movieData = {
        movieId: id.toString(),
        title: movie.title,
        poster: movie.poster_path,
        category: listType,
        overview: movie.overview || '',
        releaseDate: movie.release_date || '',
        rating: movie.vote_average?.toString() || 'N/A',
        votes: movie.vote_count?.toString() || '0',
        genreIds: movie.genres ? JSON.stringify(movie.genres.map(g => g.id)) : '[]',
        description: movie.overview || '',
        source: source
      };

      const res = await fetch('/api/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movieData),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Added to ${listType.replace('-', ' ')} list`);
        setError('');
        router.refresh();
      } else {
        setError(data.error || 'Failed to add movie to list');
      }
    } catch (err) {
      console.error('Add to list error:', err);
      setError('An error occurred while adding the movie');
    }
  };

  const handleDelete = async () => {
    if (!session) {
      setShowSignInModal(true);
      return;
    }

    try {
      // Get the category from the URL parameters
      const category = searchParams.get('category');
      
      // If no category is specified, try to find the movie in any of the user's lists
      if (!category) {
        const res = await fetch('/api/movies');
        if (res.ok) {
          const movies = await res.json();
          const movieInList = movies.find(m => m.movieId === id.toString());
          if (movieInList) {
            // Use the found category
            await deleteMovie(movieInList.category);
            return;
          }
        }
        setError('Could not determine which list to remove the movie from');
        return;
      }

      await deleteMovie(category);
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message || 'An error occurred while removing the movie');
    }
  };

  const deleteMovie = async (category) => {
    const res = await fetch('/api/movies/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        movieId: id.toString(),
        category: category,
        source: source
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to remove movie from list');
    }

    // Show success message
    alert('Movie removed from your list');
    
    // Navigate back to the home page
    router.push('/');
    router.refresh();
  };

  // Fetch user's movie lists on mount if signed in
  useEffect(() => {
    const fetchUserLists = async () => {
      if (!session) return;
      try {
        const res = await fetch('/api/movies');
        if (res.ok) {
          const movies = await res.json();
          setUserLists(movies);
          const found = movies.find(m => m.movieId === id?.toString());
          setMovieInList(found || null);
        }
      } catch (err) {
        // ignore
      }
    };
    fetchUserLists();
  }, [session, id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded w-1/4 mb-8"></div>
            <div className="h-96 bg-gray-800 rounded mb-8"></div>
            <div className="h-8 bg-gray-800 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-800 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error}</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gray-900/50 border border-white/10 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-2">Movie Not Found</h2>
            <p>The movie you're looking for could not be found.</p>
            <button
              onClick={() => router.back()}
              className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-white/70 hover:text-white px-2 py-1 rounded transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back</span>
            </button>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent ml-2">
              MyMovieList
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-white/70">{session.user?.username || session.user?.email}</span>
                <button
                  onClick={() => signIn()}
                  className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => signIn()}
                className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>
      {/* Spacer for fixed header */}
      <div className="h-16" />
      {/* Optional: Blurred/darkened backdrop */}
      {movie?.backdrop_path && (
        <>
          <div className="absolute inset-0 z-0">
            <img
              src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
              alt="Backdrop"
              className="w-full h-full object-cover"
            />
            {/* Stronger, faster vertical gradient overlay for readability */}
            <div className="absolute inset-0 pointer-events-none"
                 style={{
                   background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(24,24,27,0.95) 30%, #18181b 60%, #18181b 100%)'
                 }}
            />
          </div>
        </>
      )}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 items-start">
            {/* Main Content */}
            <div>
              <div className="flex flex-col md:flex-row gap-6 md:gap-10 mb-8 items-start">
                <div className="w-full max-w-xs md:w-56 flex-shrink-0">
                  <div className="bg-gray-900/70 backdrop-blur rounded-xl shadow-lg p-2">
                    <img
                      src={
                        movie.poster_path
                          ? (movie.poster_path.startsWith('/')
                              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                              : movie.poster_path)
                          : '/placeholder.jpg'
                      }
                      alt={movie.title}
                      className="w-full h-auto object-cover rounded-lg"
                      onError={e => {
                        if (!e.target.src.endsWith('/placeholder.jpg')) {
                          e.target.onerror = null;
                          e.target.src = '/placeholder.jpg';
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-900/80 rounded-xl shadow-lg p-6 md:p-8 mb-4">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 break-words">{movie.title}</h1>
                    <div className="flex flex-wrap items-center gap-4 mb-2 text-base md:text-lg">
                      <span className="text-yellow-400 font-bold">★ {movie.vote_average}</span>
                      <span className="text-white/70">({movie.vote_count} views)</span>
                      <span className="text-white/50">{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span>
                    </div>
                    <p className="text-white/90 mb-4 max-w-2xl leading-relaxed break-words">{movie.overview}</p>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {movie.source === 'youtube' ? (
                        <button
                          className="px-4 py-2 rounded bg-gray-700 text-white opacity-60 cursor-not-allowed"
                          disabled
                        >
                          Stream
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => setViewMode('trailer')}
                            className={`px-4 py-2 rounded ${viewMode === 'trailer' ? 'bg-red-600 text-white' : 'bg-gray-700 text-white/80'} font-semibold`}
                          >
                            Trailer
                          </button>
                          <button
                            onClick={() => setViewMode('stream')}
                            className={`px-4 py-2 rounded ${viewMode === 'stream' ? 'bg-gray-600 text-white' : 'bg-gray-700 text-white/80'} font-semibold`}
                          >
                            Stream
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Trailer/Stream Embed */}
                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-900 mb-6 shadow-lg">
                    {viewMode === 'trailer' && trailerUrl ? (
                      <iframe
                        src={trailerUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : viewMode === 'stream' && vidSrcUrl ? (
                      <iframe
                        src={vidSrcUrl}
                        className="w-full h-full"
                        allowFullScreen
                        onError={handleIframeError}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white/50">No trailer available</div>
                    )}
                  </div>
                </div>
              </div>
              {/* Cast Section */}
              {cast.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">Cast</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {cast.map((actor) => (
                      <div key={actor.id} className="text-center">
                        <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2">
                          <img
                            src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : '/placeholder.jpg'}
                            alt={actor.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="font-semibold truncate">{actor.name}</p>
                        <p className="text-sm text-white/70 truncate">{actor.character}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* TMDB Reviews */}
              {tmdbComments.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-2xl font-bold mb-4">TMDB Reviews</h2>
                  <div className="space-y-4">
                    {tmdbComments.map((review) => (
                      <div key={review.id} className="bg-gray-900/80 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{review.author}</span>
                          <span className="text-white/50">{new Date(review.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-white/80">{review.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Sidebar */}
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto lg:mx-0">
              {/* Manage List Card */}
              <div className="bg-gray-900/90 rounded-lg p-4 mb-4 shadow-lg">
                <h3 className="text-lg font-bold mb-4">Manage List</h3>
                {movieInList ? (
                  <button
                    onClick={handleDelete}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors duration-200 font-bold"
                  >
                    Remove from List
                  </button>
                ) : session && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleAddToList('watching')}
                      className="w-full bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors duration-200 font-bold"
                    >
                      Currently Watching
                    </button>
                    <button
                      onClick={() => handleAddToList('will-watch')}
                      className="w-full bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors duration-200 font-bold"
                    >
                      Will Watch
                    </button>
                    <button
                      onClick={() => handleAddToList('already-watched')}
                      className="w-full bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors duration-200 font-bold"
                    >
                      Already Watched
                    </button>
                  </div>
                )}
              </div>
              {/* Comments Card */}
              <div className="bg-gray-900/90 rounded-lg p-4 shadow-lg">
                <h3 className="text-lg font-bold mb-4">Comments</h3>
                {session ? (
                  <form onSubmit={handleCommentSubmit} className="mb-4">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={3}
                    />
                    <button
                      type="submit"
                      className="mt-2 w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200 font-bold"
                    >
                      Post Comment
                    </button>
                  </form>
                ) : (
                  <p className="text-white/60 mb-2">Sign in to comment</p>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {comments.length > 0 ? comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-800/80 p-2 rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{comment.authorName}</span>
                        <span className="text-white/50 text-xs">{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-white/80 text-sm">{comment.text}</p>
                    </div>
                  )) : (
                    <p className="text-white/50 text-center py-2">No comments yet. Be the first to comment!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="mt-16">
          <Footer
            homeRef={homeRef}
            popularRef={popularRef}
            topRatedRef={topRatedRef}
            upcomingRef={upcomingRef}
            localMoviesRef={localMoviesRef}
            watchingRef={watchingRef}
            watchLaterRef={watchLaterRef}
            alreadyWatchedRef={alreadyWatchedRef}
          />
        </div>
      </div>
    </div>
  );
}

// Helper functions
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const formatNumber = (num) => {
  return new Intl.NumberFormat().format(num);
};

const calculateRating = (stats) => {
  if (!stats?.likeCount || !stats?.viewCount) return 'N/A';
  const likeToViewRatio = (parseInt(stats.likeCount) / parseInt(stats.viewCount)) * 10;
  return likeToViewRatio.toFixed(1);
};

const parseYouTubeDuration = (duration) => {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const h = match[1] ? parseInt(match[1]) : 0;
  const m = match[2] ? parseInt(match[2]) : 0;
  const s = match[3] ? parseInt(match[3]) : 0;
  return h * 3600 + m * 60 + s;
};