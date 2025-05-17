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

  // ... rest of your state declarations ...

  useEffect(() => {
    // Guard against undefined searchParams
    if (!searchParams) {
      console.log('Search params not initialized yet');
      return;
    }

    console.log('Session status:', status, 'Session:', session);
    if (status !== 'loading' && session) {
      // Fetch user movies for all sections
      const fetchAllUserMovies = async () => {
        await Promise.all([
          fetchUserMovies('watching', true),
          fetchUserMovies('will-watch', true),
          fetchUserMovies('already-watched', true)
        ]);
      };
      fetchAllUserMovies();
    }
    if (status !== 'loading') {
      fetchMoviesForSection('popular-movies');
      fetchMoviesForSection('upcoming-movies');
      fetchMoviesForSection('top-rated-movies');
      fetchBhutaneseMovies();
      Object.keys(carousels).forEach((sectionId) => {
        const carousel = carousels[sectionId].current;
        if (carousel) {
          carousel.addEventListener('scroll', handleScroll(sectionId));
        }
      });
    }

    // Add event listener for showing sign-in modal
    const handleShowSignIn = () => {
      setShowSignIn(true);
    };
    window.addEventListener('showSignIn', handleShowSignIn);

    // Get section from URL parameters
    const section = searchParams.get('section');
    if (section) {
      // Map section IDs to their refs
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
        // Wait for the page to load
        setTimeout(() => {
          const elementPosition = ref.current.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - 64; // 64px is header height

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }, 100);
      }
    }

    return () => {
      Object.keys(carousels).forEach((sectionId) => {
        const carousel = carousels[sectionId].current;
        if (carousel) {
          carousel.removeEventListener('scroll', handleScroll(sectionId));
        }
      });
      // Clean up event listener
      window.removeEventListener('showSignIn', handleShowSignIn);
    };
  }, [status, session, searchParams]);

  // ... rest of your component code ...

  if (status === 'loading') {
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

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* ... rest of your JSX ... */}
    </main>
  );
} 