'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import MovieCard from './MovieCard';

export default function InfiniteMovieScroll({ movies, title, category, onDelete, source }) {
  const scrollContainerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [uniqueMovies, setUniqueMovies] = useState([]);
  const [processedIds] = useState(new Set());
  const scrollTimeoutRef = useRef(null);

  // Debounced scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isLoading || !hasMore) return;

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set a new timeout
    scrollTimeoutRef.current = setTimeout(() => {
      const container = scrollContainerRef.current;
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;

      // Load more when user scrolls to 80% of the container width
      if (scrollLeft + clientWidth >= scrollWidth * 0.8) {
        loadMore();
      }
    }, 150); // 150ms debounce
  }, [isLoading, hasMore]);

  // Function to load more movies
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      // Get the next batch of movies
      const startIndex = (page - 1) * 10;
      const endIndex = page * 10;
      
      // Check if we've reached the end of available movies
      if (startIndex >= movies.length) {
        setHasMore(false);
        return;
      }

      const newMovies = movies.slice(startIndex, endIndex);
      
      if (newMovies.length === 0) {
        setHasMore(false);
        return;
      }

      // Filter out duplicates based on movie ID
      const uniqueNewMovies = newMovies.filter(movie => {
        const movieKey = `${movie.id}-${movie.source || source}`;
        if (processedIds.has(movieKey)) {
          return false;
        }
        processedIds.add(movieKey);
        return true;
      });

      if (uniqueNewMovies.length > 0) {
        setUniqueMovies(prev => [...prev, ...uniqueNewMovies]);
        setPage(prev => prev + 1);
      } else {
        // If no new unique movies were found and we're at the end of the list
        if (endIndex >= movies.length) {
          setHasMore(false);
        } else {
          // Try the next page
          setPage(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Error loading more movies:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, page, movies, source, processedIds]);

  // Initialize movies when the component mounts or movies prop changes
  useEffect(() => {
    if (movies && movies.length > 0) {
      // Reset state when movies prop changes
      processedIds.clear();
      const initialMovies = movies.slice(0, 10);
      
      // Filter initial movies for uniqueness
      const uniqueInitialMovies = initialMovies.filter(movie => {
        const movieKey = `${movie.id}-${movie.source || source}`;
        if (processedIds.has(movieKey)) {
          return false;
        }
        processedIds.add(movieKey);
        return true;
      });

      setUniqueMovies(uniqueInitialMovies);
      setPage(2); // Start from page 2 since we've shown page 1
      setHasMore(movies.length > 10); // Set hasMore based on remaining movies
    } else {
      setUniqueMovies([]);
      setPage(1);
      setHasMore(false);
    }
  }, [movies, source]);

  // Add scroll event listener with cleanup
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [handleScroll]);

  if (!movies || movies.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
        {title}
      </h2>
      {uniqueMovies.length === 0 && category ? (
        <div className="text-red-500 text-center py-8 bg-gray-900/50 rounded-xl border border-white/5">
          Please add a movie to your list and try again!
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {uniqueMovies.map((movie, index) => (
            <div 
              key={`${movie.id}-${movie.source || source}-${index}`} 
              className="flex-none w-64"
              data-genres={movie.genre_ids ? movie.genre_ids.join(' ') : ''}
            >
              <MovieCard
                movie={{
                  ...movie,
                  genre_ids: movie.genre_ids || []
                }}
                category={category}
                onDelete={onDelete}
                source={movie.source || source}
              />
            </div>
          ))}
          {isLoading && (
            <div className="flex-none w-64 h-96 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 