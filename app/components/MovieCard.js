'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

export default function MovieCard({ movie, category, onDelete, source = 'tmdb' }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedList, setSelectedList] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  // Add genre lookup
  const genreLookup = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Sci-Fi',
    53: 'Thriller',
    10752: 'War',
    37: 'Western'
  };

  // Get movie genres
  const getMovieGenres = () => {
    if (!movie.genre_ids || !Array.isArray(movie.genre_ids)) return [];
    return movie.genre_ids.map(id => genreLookup[id] || '').filter(Boolean);
  };

  const handleClick = (e) => {
    // Don't navigate if clicking the add button or modal
    if (e.target.closest('.add-button') || e.target.closest('.modal-content')) {
      return;
    }

    if (source === 'youtube') {
      // For YouTube videos, navigate to the movie detail page
      const params = new URLSearchParams({
        source: 'youtube',
        category: category || ''
      });
      router.push(`/movie/${movie.id}?${params.toString()}`);
    } else {
      // For TMDB movies, navigate to the details page
      const params = new URLSearchParams({
        source: 'tmdb',
        category: category || ''
      });
      router.push(`/movie/${movie.id}?${params.toString()}`);
    }
  };

  const handleAddClick = (e) => {
    e.stopPropagation(); // Stop the event from bubbling up
    setShowAddModal(true);
  };

  const handleAddToList = async () => {
    if (!selectedList) {
      setError('Please select a list');
      return;
    }

    try {
      const movieData = {
        movieId: movie.id.toString(),
        title: movie.title,
        poster: movie.poster_path,
        category: selectedList,
        overview: movie.overview || '',
        releaseDate: movie.release_date || '',
        rating: movie.vote_average?.toString() || 'N/A',
        votes: movie.vote_count?.toString() || '0',
        genreIds: movie.genre_ids ? JSON.stringify(movie.genre_ids) : '[]',
        description: movie.overview || '',
        source: source || 'tmdb'
      };

      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movieData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add movie to list');
      }
      
      setError('');
      setShowAddModal(false);
      setSelectedList('');
      
      // Reload the page after successful addition
      window.location.reload();
    } catch (err) {
      console.error('Error adding movie:', err);
      setError(err.message || 'Failed to add movie to list');
    }
  };

  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (showDeleteConfirm) {
      onDelete(movie.id);
    } else {
      setShowDeleteConfirm(true);
      setTimeout(() => setShowDeleteConfirm(false), 2000);
    }
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowDeleteConfirm(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowDeleteConfirm(false);
  };

  const getPosterPath = () => {
    if (source === 'youtube') {
      // For YouTube videos, use the thumbnail directly
      return movie.snippet?.thumbnails?.high?.url || 
             movie.snippet?.thumbnails?.medium?.url || 
             movie.snippet?.thumbnails?.default?.url || 
             '/placeholder.jpg';
    }
    // For TMDB movies
    return movie.poster_path 
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : '/placeholder.jpg';
  };

  const getTitle = () => {
    if (source === 'youtube') {
      return movie.snippet?.title || movie.title || 'Untitled Video';
    }
    return movie.title || movie.name || 'Untitled';
  };

  const getReleaseDate = () => {
    if (source === 'youtube') {
      return movie.snippet?.publishedAt 
        ? new Date(movie.snippet.publishedAt).toLocaleDateString()
        : 'Unknown date';
    }
    return movie.release_date || movie.first_air_date || 'Unknown date';
  };

  const getRating = () => {
    if (source === 'youtube') {
      return movie.vote_average || 'N/A';
    }
    return movie.vote_average 
      ? Number(movie.vote_average).toFixed(1)
      : 'N/A';
  };

  // Check if the movie is in a user's list section
  const isUserListSection = ['watching', 'will-watch', 'already-watched'].includes(category);

  const isYouTube = source === 'youtube';

  return (
    <div 
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative group cursor-pointer bg-gray-900 rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105"
    >
      <div className="relative aspect-[2/3]">
        <Image
          src={movie.poster_path ? (source === 'youtube' ? movie.poster_path : `https://image.tmdb.org/t/p/w500${movie.poster_path}`) : '/placeholder.jpg'}
          alt={movie.title}
          fill
          className={`object-cover transition-transform duration-300 ${
            isHovered ? 'scale-110' : 'scale-100'
          }`}
        />
        {source === 'youtube' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="text-white text-center p-4">
              <p className="font-semibold mb-2">{movie.title}</p>
              <p className="text-sm text-gray-300">{movie.channelTitle}</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Button - Show for both TMDB and YouTube movies when not in user lists */}
      {!category && session && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleAddClick(e);
          }}
          className="absolute bottom-4 right-4 z-20 bg-black/70 text-white px-4 py-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/90 add-button"
        >
          Add to List
        </button>
      )}

      {/* Hover Overlay */}
      {isHovered && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-between p-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 line-clamp-2">{getTitle()}</h3>
            {!isYouTube && (
              <>
                <p className="text-sm text-white/70 line-clamp-3">{movie.overview}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {getMovieGenres().map((genre, index) => (
                    <span key={index} className="text-xs bg-white/10 px-2 py-1 rounded-full">
                      {genre}
                    </span>
                  ))}
                </div>
              </>
            )}
            {isYouTube && (
              <div className="mt-2">
                <p className="text-sm text-white/70">{movie.channelTitle || 'Unknown Channel'}</p>
                <p className="text-sm text-white/70 mt-1">
                  {movie.duration ? formatDuration(movie.duration) : 'Duration: N/A'}
                </p>
                {movie.overview && (
                  <p className="text-sm text-white/70 mt-2 line-clamp-3">{movie.overview}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">★</span>
              <span>{getRating()}</span>
            </div>
            {/* Only show remove button in user list sections */}
            {isUserListSection && (
              <button
                onClick={handleDelete}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                  showDeleteConfirm
                    ? 'bg-red-500 text-white'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {showDeleteConfirm ? 'Click to Confirm' : 'Remove'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add to List Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] modal-content"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}
        >
          <div 
            className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-white/5 w-full max-w-md relative"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAddModal(false);
              }}
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Add to List
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Select List
                </label>
                <select
                  value={selectedList}
                  onChange={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedList(e.target.value);
                  }}
                  className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <option value="">Select a list...</option>
                  <option value="watching">Currently Watching</option>
                  <option value="will-watch">Watch Later</option>
                  <option value="already-watched">Already Watched</option>
                </select>
              </div>
              {error && (
                <p className="text-red-500 text-sm">{error}</p>
              )}
              <div className="flex justify-end gap-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddModal(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddToList();
                  }}
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-red-500/20"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}