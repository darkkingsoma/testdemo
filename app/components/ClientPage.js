'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import MovieCard from './MovieCard';
import GenreFilter from './GenreFilter';
import { useSession, signIn, signOut } from 'next-auth/react';
import Footer from './Footer';
import InfiniteMovieScroll from './InfiniteMovieScroll';
import SearchBar from './SearchBar';
import { useSearchParams } from 'next/navigation';

export default function ClientPage() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  // Initialize state
  const [isInitialized, setIsInitialized] = useState(false);
  const [userMovieLists, setUserMovieLists] = useState({
    Watching: [],
    'Will Watch': [],
    'Already Watched': [],
  });

  // ... rest of your state declarations ...

  // Initialize the component
  useEffect(() => {
    if (!searchParams) {
      console.log('Search params not initialized yet');
      return;
    }

    setIsInitialized(true);
  }, [searchParams]);

  // Main effect that runs after initialization
  useEffect(() => {
    if (!isInitialized || !searchParams) return;

    // Initialize data fetching
    const initializeData = async () => {
      if (status !== 'loading' && session) {
        // Fetch user movies for all sections
        await Promise.all([
          fetchUserMovies('watching', true),
          fetchUserMovies('will-watch', true),
          fetchUserMovies('already-watched', true)
        ]);
      }
      
      if (status !== 'loading') {
        await Promise.all([
          fetchMoviesForSection('popular-movies'),
          fetchMoviesForSection('upcoming-movies'),
          fetchMoviesForSection('top-rated-movies'),
          fetchBhutaneseMovies()
        ]);
      }
    };

    // Initialize event listeners
    const initializeEventListeners = () => {
      Object.keys(carousels).forEach((sectionId) => {
        const carousel = carousels[sectionId].current;
        if (carousel) {
          carousel.addEventListener('scroll', handleScroll(sectionId));
        }
      });

      const handleShowSignIn = () => {
        setShowSignIn(true);
      };
      window.addEventListener('showSignIn', handleShowSignIn);

      return () => {
        Object.keys(carousels).forEach((sectionId) => {
          const carousel = carousels[sectionId].current;
          if (carousel) {
            carousel.removeEventListener('scroll', handleScroll(sectionId));
          }
        });
        window.removeEventListener('showSignIn', handleShowSignIn);
      };
    };

    // Handle section navigation
    const handleSectionNavigation = () => {
      const section = searchParams.get('section');
      if (section) {
        const sectionRefs = {
          'watching': watchingRef,
          'will-watch': watchLaterRef,
          'already-watched': alreadyWatchedRef,
          'popular-movies': popularRef,
          'top-rated-movies': topRatedRef,
          'upcoming-movies': upcomingRef,
          'local-movies': bhutaneseMoviesRef
        };

        const ref = sectionRefs[section];
        if (ref?.current) {
          setTimeout(() => {
            const elementPosition = ref.current.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - 64;
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }, 100);
        }
      }
    };

    // Initialize everything
    initializeData();
    const cleanup = initializeEventListeners();
    handleSectionNavigation();

    return cleanup;
  }, [isInitialized, status, session, searchParams]);

  if (!isInitialized || status === 'loading') {
    return (
      <div className="min-h-screen bg-black">
        <div className="animate-pulse">
          <div className="h-16 bg-gray-900"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="h-8 bg-gray-800 rounded w-1/4 mb-8"></div>
            <div className="h-64 bg-gray-800 rounded mb-8"></div>
            <div className="h-8 bg-gray-800 rounded w-1/4 mb-8"></div>
            <div className="h-64 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // ... rest of your component code ...
} 