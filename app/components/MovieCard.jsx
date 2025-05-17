'use client';

import { useRouter } from 'next/navigation';

const genreLookup = {
  28: 'action',
  12: 'adventure',
  16: 'animation',
  35: 'comedy',
  80: 'crime',
  99: 'documentary',
  18: 'drama',
  10751: 'family',
  14: 'fantasy',
  36: 'biography',
  27: 'horror',
  9648: 'mystery',
  10749: 'romance',
  878: 'sci-fi',
  53: 'thriller',
};

export default function MovieCard({ movie, source, onClick, isSelected }) {
  const router = useRouter();

  // Handle both TMDB and YouTube movie formats
  const poster = source === 'tmdb'
    ? movie.poster_path || movie.poster
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path || movie.poster}`
      : '/placeholder.jpg'
    : movie.thumbnail || movie.poster_path || movie.poster || '/placeholder.jpg';

  // Handle both TMDB genre_ids and direct genre strings
  const genres = source === 'tmdb'
    ? (movie.genre_ids || []).map((id) => genreLookup[id] || 'other').join(' ')
    : movie.genre || 'drama';

  // Safely get all possible fields
  const movieId = movie.id || movie.movieId || '';
  const title = movie.title || 'Untitled Movie';
  const description = movie.overview || movie.description || '';
  const releaseDate = movie.release_date || movie.releaseDate || '';
  const rating = movie.vote_average || movie.rating || 'N/A';
  const votes = movie.vote_count || movie.votes || '0';
  const posterPath = movie.poster_path || movie.poster || movie.thumbnail || '';

  const handleClick = (e) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    } else {
      const queryParams = new URLSearchParams({
        id: movieId,
        source: source || (movieId.match(/^[a-zA-Z0-9_-]+$/) ? 'youtube' : 'tmdb'),
        title: encodeURIComponent(title),
        description: encodeURIComponent(description),
        releaseDate: encodeURIComponent(releaseDate),
        rating: encodeURIComponent(rating),
        votes: encodeURIComponent(votes),
        posterPath: encodeURIComponent(posterPath),
      });

      router.push(`/movie/${movieId}?${queryParams.toString()}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`movie-card flex-shrink-0 w-48 sm:w-56 bg-mono-medium rounded-md overflow-hidden shadow-lg transition-transform duration-200 hover:scale-105 snap-start cursor-pointer block ${isSelected ? 'ring-2 ring-red-500' : ''}`}
      data-genres={genres}
    >
      <div className="relative w-full h-64">
        <img
          src={poster}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null; // Prevent infinite loop
            e.target.src = '/placeholder.jpg';
          }}
        />
      </div>
      <div className="p-3">
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        <p className="text-xs text-mono-accent">
          Rating: {rating} ⭐ ({votes} votes)
        </p>
      </div>
    </div>
  );
}