'use client';

import { useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';

export default function Footer({ 
  homeRef, 
  popularRef, 
  topRatedRef, 
  upcomingRef, 
  localMoviesRef, 
  watchingRef, 
  watchLaterRef, 
  alreadyWatchedRef,
  onShowSignIn 
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const headerHeight = 64; // Height of the header in pixels

  const scrollToSection = (ref, sectionId) => {
    if (!session) {
      onShowSignIn();
      return;
    }

    // If we're on the movie detail page, navigate to home with the section
    if (pathname.startsWith('/movie/')) {
      router.push(`/?section=${sectionId}`);
      return;
    }

    // If we're on the home page, scroll to the section
    if (ref?.current) {
      const elementPosition = ref.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About Us */}
          <div>
            <h3 className="text-lg font-semibold mb-4">About Us</h3>
            <p className="text-gray-400">
              MyMovieList is a free platform for you to browse, and track both your international and Bhutanese movies. Enjoy.
            </p>
          </div>

          {/* My Lists */}
          <div>
            <h3 className="text-lg font-semibold mb-4">My Lists</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => scrollToSection(watchingRef, 'watching')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Currently Watching
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection(watchLaterRef, 'will-watch')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Watch Later
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection(alreadyWatchedRef, 'already-watched')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Already Watched
                </button>
              </li>
            </ul>
          </div>

          {/* Browse */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Browse</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => scrollToSection(popularRef, 'popular-movies')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Popular Movies
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection(topRatedRef, 'top-rated-movies')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Top Rated Movies
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection(upcomingRef, 'upcoming-movies')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Upcoming Movies
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection(localMoviesRef, 'local-movies')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Local Bhutanese Movies
                </button>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Connect</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/somacruzlistic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} MyMovieList. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
} 