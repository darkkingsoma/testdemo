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
  const { id } = useParams();
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

  // Get source from URL parameters, default to 'tmdb' if not specified
  const source = searchParams.get('source') || 'tmdb';
  const category = searchParams.get('category');

  const vidSrcUrl = imdbId
    ? `https://vidsrc.to/embed/movie/${imdbId}`
    : `https://vidsrc.to/embed/movie/${encodeURIComponent(movie?.title?.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').toLowerCase() || '')}`;

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

        console.log('Fetching TMDB data for movie:', id);
        
        // Fetch movie details
        const movieRes = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}`);
        if (!movieRes.ok) {
          throw new Error(`Failed to fetch movie data: ${movieRes.statusText}`);
        }
        const movieData = await movieRes.json();
        setMovie(movieData);

        // Fetch videos (trailers)
        const videosRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${TMDB_API_KEY}`);
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          const trailer = videosData.results.find(video => video.type === 'Trailer');
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
          setCast(creditsData.cast.slice(0, 10));
        }

        // Fetch reviews
        const reviewsRes = await fetch(`https://api.themoviedb.org/3/movie/${id}/reviews?api_key=${TMDB_API_KEY}`);
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setTmdbComments(reviewsData.results || []);
        }
      } else {
        // Handle YouTube video
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${id}&key=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`);
        if (!response.ok) throw new Error('Failed to fetch video details');
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
          throw new Error('Video not found');
        }

        const video = data.items[0];
        setMovie({
          id: video.id,
          title: video.snippet.title.replace(/[^\w\s]/gi, ''),
          overview: video.snippet.description,
          poster_path: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url,
          release_date: video.snippet.publishedAt,
          vote_average: calculateRating(video.statistics),
          vote_count: video.statistics.viewCount,
          source: 'youtube',
          videoId: video.id,
          channelTitle: video.snippet.channelTitle,
          likeCount: video.statistics.likeCount,
          commentCount: video.statistics.commentCount,
          duration: parseYouTubeDuration(video.contentDetails.duration)
        });

        // Fetch comments
        const commentsResponse = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${id}&key=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}&maxResults=10`);
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          setComments(commentsData.items || []);
        }
      }
    } catch (error) {
      console.error('Error fetching movie data:', error);
      setError(error.message);
      setMovie(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, source]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/comments?videoId=${id}`);
        if (!response.ok) throw new Error('Failed to fetch comments');
        const data = await response.json();
        setComments(data);
      } catch (error) {
        console.error('Error fetching comments:', error);
        setError('Failed to load comments');
      }
    };

    if (id) {
      fetchComments();
    }
  }, [id]);

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

      if (!response.ok) throw new Error('Failed to post comment');
      
      const comment = await response.json();
      setComments(prev => [comment, ...prev]);
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
      setError('Failed to post comment');
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="animate-pulse">
          <div className="h-[70vh] bg-gray-900"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
            <div className="h-12 bg-gray-800 rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-gray-800 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-800 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Error Loading Movie</h1>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Movie not found</h1>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Backdrop Image */}
      <div className="relative h-[70vh] w-full">
        <Image
          src={source === 'youtube' 
            ? movie.poster_path // Use the YouTube thumbnail as backdrop
            : movie.backdrop_path 
              ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
              : movie.poster_path 
                ? `https://image.tmdb.org/t/p/original${movie.poster_path}`
                : '/placeholder.jpg'
          }
          alt={movie.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
        
        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="absolute top-4 left-4 z-20 px-4 py-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column - Main Content */}
            <div className="flex-1">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Poster */}
                <div className="w-full md:w-1/3 lg:w-1/4">
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-xl">
                    <Image
                      src={source === 'youtube'
                        ? movie.poster_path // Use the YouTube thumbnail directly
                        : movie.poster_path 
                          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                          : '/placeholder.jpg'
                      }
                      alt={movie.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <h1 className="text-4xl font-bold mb-4">{movie.title}</h1>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-yellow-400">★ {Number(movie.vote_average)?.toFixed(1) || 'N/A'}</span>
                    <span className="text-gray-400">({movie.vote_count || 0} views)</span>
                    <span className="text-gray-400">
                      {source === 'youtube' 
                        ? new Date(movie.release_date).toLocaleDateString()
                        : movie.release_date?.split('-')[0] || 'N/A'
                      }
                    </span>
                  </div>
                  <p className="text-gray-300 mb-6">{movie.overview}</p>

                  {/* Video Player Section */}
                  {source === 'youtube' ? (
                    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden mb-6">
                      <iframe
                        src={`https://www.youtube.com/embed/${movie.videoId}?autoplay=1`}
                        className="w-full h-full"
                        allowFullScreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      ></iframe>
                    </div>
                  ) : (
                    <>
                      {/* View Toggle */}
                      <div className="flex gap-4 mb-6">
                        <button
                          onClick={handleViewToggle}
                          className={`px-4 py-2 rounded ${
                            viewMode === 'trailer' 
                              ? 'bg-red-600 text-white' 
                              : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          Trailer
                        </button>
                        <button
                          onClick={handleViewToggle}
                          className={`px-4 py-2 rounded ${
                            viewMode === 'stream' 
                              ? 'bg-red-600 text-white' 
                              : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          Stream
                        </button>
                      </div>

                      {/* Video Player */}
                      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden mb-6">
                        {viewMode === 'trailer' ? (
                          trailerUrl ? (
                            <iframe
                              src={trailerUrl}
                              className="w-full h-full"
                              allowFullScreen
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            ></iframe>
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              No trailer available
                            </div>
                          )
                        ) : (
                          streamError ? (
                            <div className="flex items-center justify-center h-full text-red-500">
                              {streamError}
                            </div>
                          ) : (
                            <iframe
                              src={vidSrcUrl}
                              className="w-full h-full"
                              allowFullScreen
                              onError={handleIframeError}
                            ></iframe>
                          )
                        )}
                      </div>
                    </>
                  )}

                  {/* Cast */}
                  {cast.length > 0 && (
                    <div className="mb-8">
                      <h2 className="text-2xl font-bold mb-4">Cast</h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {cast.map((actor) => (
                          <div key={actor.id} className="text-center">
                            <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2">
                              <Image
                                src={actor.profile_path 
                                  ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                                  : '/placeholder.jpg'
                                }
                                alt={actor.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                            <h3 className="font-semibold">{actor.name}</h3>
                            <p className="text-sm text-gray-400">{actor.character}</p>
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
                        {tmdbComments.slice(0, 10).map((review) => (
                          <div key={review.id} className="bg-gray-800/50 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-semibold">{review.author}</span>
                              <span className="text-sm text-gray-400">
                                {new Date(review.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-gray-300 line-clamp-3">{review.content}</p>
                            <button 
                              onClick={() => window.open(review.url, '_blank')}
                              className="text-red-500 text-sm mt-2 hover:text-red-400"
                            >
                              Read full review
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - List Management */}
            <div className="w-full lg:w-80 space-y-6">
              {/* List Management */}
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <h2 className="text-xl font-bold mb-4">Manage List</h2>
                <div className="space-y-3">
                  {/* Only show add buttons if the movie is not from a user's list */}
                  {!category && (
                    <>
                      <button
                        onClick={() => handleAddToList('watching')}
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        Currently Watching
                      </button>
                      <button
                        onClick={() => handleAddToList('will-watch')}
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        Will Watch
                      </button>
                      <button
                        onClick={() => handleAddToList('already-watched')}
                        className="w-full px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                      >
                        Already Watched
                      </button>
                    </>
                  )}
                  {/* Only show remove button if the movie is from a user's list */}
                  {category && (
                    <button
                      onClick={handleDelete}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Remove from List
                    </button>
                  )}
                </div>
              </div>

              {/* Comments Section */}
              <div className="bg-gray-800/50 p-4 rounded-lg">
                <h2 className="text-xl font-bold mb-4">Comments</h2>
                {session ? (
                  <form onSubmit={handleCommentSubmit} className="mb-6">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="w-full p-3 bg-gray-700 rounded-lg text-white mb-2"
                      rows="3"
                    ></textarea>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                    >
                      Post Comment
                    </button>
                  </form>
                ) : (
                  <p className="text-gray-400 mb-4">Please sign in to comment</p>
                )}
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-700 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold">{comment.authorName}</span>
                        <span className="text-sm text-gray-400">
                          {new Date(comment.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <p className="text-gray-300">{comment.text}</p>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-gray-400 text-center py-4">No comments yet. Be the first to comment!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign In Modal */}
      {showSignInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-white/5 w-full max-w-md relative">
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Sign In Required
            </h2>
            <p className="text-white/70 mb-6">
              Please sign in to access your movie lists and track your favorite movies.
            </p>
            <button
              onClick={() => signIn()}
              className="w-full px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-red-500/20"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto">
        <Footer
          homeRef={homeRef}
          popularRef={popularRef}
          topRatedRef={topRatedRef}
          upcomingRef={upcomingRef}
          localMoviesRef={localMoviesRef}
          watchingRef={watchingRef}
          watchLaterRef={watchLaterRef}
          alreadyWatchedRef={alreadyWatchedRef}
          onShowSignIn={() => setShowSignInModal(true)}
        />
      </div>
    </div>
  );
}

// Helper functions
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
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