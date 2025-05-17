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
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Movie Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden">
            <img
              src={movie.poster_path}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
          </div>
          
          <div className="md:col-span-2">
            <h1 className="text-3xl font-bold mb-4">{movie.title}</h1>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-yellow-400">★</span>
              <span>{movie.vote_average}/10</span>
              <span className="text-white/50">|</span>
              <span>{movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}</span>
              {movie.source === 'youtube' && (
                <>
                  <span className="text-white/50">|</span>
                  <span>{movie.channelTitle}</span>
                  <span className="text-white/50">|</span>
                  <span>{formatDuration(movie.duration)}</span>
                </>
              )}
            </div>
            <p className="text-white/70 mb-6">{movie.overview}</p>
            
            {session && (
              <div className="flex gap-4">
                <button
                  onClick={() => handleAddToList('watching')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Currently Watching
                </button>
                <button
                  onClick={() => handleAddToList('will-watch')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Watch Later
                </button>
                <button
                  onClick={() => handleAddToList('already-watched')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200"
                >
                  Already Watched
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Video Player */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Watch</h2>
            {movie.source === 'youtube' ? (
              <div className="flex items-center gap-4">
                <span className="text-white/70">
                  {formatNumber(movie.likeCount)} likes
                </span>
                <span className="text-white/70">
                  {formatNumber(movie.vote_count)} views
                </span>
              </div>
            ) : imdbId && (
              <button
                onClick={handleViewToggle}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                {viewMode === 'trailer' ? 'Switch to Stream' : 'Switch to Trailer'}
              </button>
            )}
          </div>
          
          <div className="aspect-video rounded-lg overflow-hidden bg-gray-900">
            {viewMode === 'trailer' ? (
              <iframe
                src={trailerUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <iframe
                src={vidSrcUrl}
                className="w-full h-full"
                allowFullScreen
                onError={handleIframeError}
              />
            )}
          </div>
          
          {streamError && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-500/50 rounded-lg">
              <p>{streamError}</p>
            </div>
          )}
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
                  <p className="font-semibold">{actor.name}</p>
                  <p className="text-sm text-white/70">{actor.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Comments</h2>
            {session ? (
              <button
                onClick={() => setShowComments(!showComments)}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                {showComments ? 'Hide Comments' : 'Show Comments'}
              </button>
            ) : (
              <button
                onClick={() => setShowSignInModal(true)}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                Sign in to Comment
              </button>
            )}
          </div>

          {showComments && (
            <div className="space-y-4">
              {session && (
                <form onSubmit={handleCommentSubmit} className="mb-6">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    rows={3}
                  />
                  <button
                    type="submit"
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
                  >
                    Post Comment
                  </button>
                </form>
              )}

              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-900/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{comment.authorName}</span>
                      <span className="text-white/50">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                      {comment.likeCount > 0 && (
                        <span className="text-white/50">
                          • {formatNumber(comment.likeCount)} likes
                        </span>
                      )}
                    </div>
                    <p className="text-white/70">{comment.text}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-white/50 text-center py-4">No comments yet. Be the first to comment!</p>
                )}
              </div>
            </div>
          )}
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