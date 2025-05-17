'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import MovieCard from './components/MovieCard';
import GenreFilter from './components/GenreFilter';
import { useSession, signIn, signOut } from 'next-auth/react';
import Footer from './components/Footer';
import InfiniteMovieScroll from './components/InfiniteMovieScroll';
import SearchBar from './components/SearchBar';
import { useSearchParams } from 'next/navigation';

// Create a client component for the main content
function MainContent() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  const [userMovieLists, setUserMovieLists] = useState({
    Watching: [],
    'Will Watch': [],
    'Already Watched': [],
  });

  const [userListsState, setUserListsState] = useState({
    Watching: { isFetching: false, error: null },
    'Will Watch': { isFetching: false, error: null },
    'Already Watched': { isFetching: false, error: null },
  });

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
    37: 'Western',
    10770: 'TV Movie',
    10759: 'Action & Adventure',
    10762: 'Kids',
    10763: 'News',
    10764: 'Reality',
    10765: 'Sci-Fi & Fantasy',
    10766: 'Soap',
    10767: 'Talk',
    10768: 'War & Politics'
  };

  // Create a normalized genre lookup that handles spaces and special characters
  const genreNameToId = Object.fromEntries(
    Object.entries(genreLookup).map(([id, name]) => [
      name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      parseInt(id)
    ])
  );

  const [movieSectionState, setMovieSectionState] = useState({
    'popular-movies': { page: 1, genre: 'all', isFetching: false, movies: [], error: null, hasMore: true },
    'upcoming-movies': { page: 1, genre: 'all', isFetching: false, movies: [], error: null, hasMore: true },
    'top-rated-movies': { page: 1, genre: 'all', isFetching: false, movies: [], error: null, hasMore: true },
    'bhutanese-movies': { pageToken: '', genre: 'all', isFetching: false, searchQuery: '', movies: [], error: null, hasMore: true },
    'watching': { page: 1, genre: 'all', isFetching: false, movies: [], error: null, hasMore: true },
    'will-watch': { page: 1, genre: 'all', isFetching: false, movies: [], error: null, hasMore: true },
    'already-watched': { page: 1, genre: 'all', isFetching: false, movies: [], error: null, hasMore: true },
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [bhutaneseSearchQuery, setBhutaneseSearchQuery] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [selectedList, setSelectedList] = useState('');
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Add refs for scroll navigation
  const homeRef = useRef(null);
  const popularRef = useRef(null);
  const topRatedRef = useRef(null);
  const upcomingRef = useRef(null);
  const bhutaneseMoviesRef = useRef(null);
  const watchingRef = useRef(null);
  const watchLaterRef = useRef(null);
  const alreadyWatchedRef = useRef(null);

  const carousels = {
    watching: useRef(null),
    'will-watch': useRef(null),
    'already-watched': useRef(null),
    'popular-movies': useRef(null),
    'upcoming-movies': useRef(null),
    'top-rated-movies': useRef(null),
    'bhutanese-movies': useRef(null),
    'search-results': useRef(null),
  };

  const fetchUserMovies = async (sectionId, reset = false) => {
    try {
      setUserListsState(prev => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], isFetching: true, error: null }
      }));

      const response = await fetch('/api/movies');
      if (!response.ok) throw new Error('Failed to fetch user movies');
      const data = await response.json();

      // Transform the data to match the expected format
      const categoryKey = {
        'watching': 'watching',
        'will-watch': 'will-watch',
        'already-watched': 'already-watched'
      }[sectionId];

      const movies = data[categoryKey] || [];
      const transformedMovies = movies.map(movie => ({
        id: movie.movieId,
        title: movie.title,
        poster_path: movie.poster,
        overview: movie.overview,
        release_date: movie.releaseDate,
        vote_average: movie.rating,
        vote_count: movie.votes,
        genre_ids: JSON.parse(movie.genreIds || '[]'),
        description: movie.description,
        source: movie.source || 'tmdb'
      }));

      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          movies: reset ? transformedMovies : [...prev[sectionId].movies, ...transformedMovies],
          error: null
        }
      }));
    } catch (error) {
      console.error(`Error fetching ${sectionId} movies:`, error);
      setUserListsState(prev => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], error: error.message }
      }));
    } finally {
      setUserListsState(prev => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], isFetching: false }
      }));
    }
  };

  // Add debounce function
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const handleScroll = useCallback((sectionId) => debounce(async () => {
    const state = movieSectionState[sectionId];
    const carousel = carousels[sectionId].current;
    if (!carousel || !state || state.isFetching || !state.hasMore) return;

    const nearEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 50;
    if (nearEnd && sectionId !== 'watching' && sectionId !== 'will-watch' && sectionId !== 'already-watched') {
      setMovieSectionState((prev) => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], isFetching: true },
      }));

      if (sectionId === 'bhutanese-movies') {
        await fetchBhutaneseMovies(state.searchQuery, state.pageToken);
      } else {
        await fetchMoviesForSection(sectionId);
      }

      setMovieSectionState((prev) => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], isFetching: false },
      }));
    }
  }, 300), [movieSectionState, carousels]);

  const handleGenreChange = (genre) => {
    // Convert genre to lowercase and remove special characters for matching
    const normalizedGenre = genre.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Toggle genre selection
    setSelectedGenres(prev => {
      // If the same genre is clicked, clear the selection
      if (prev.includes(genre.toLowerCase())) {
        return [];
      }
      // Otherwise, set only this genre
      return [genre.toLowerCase()];
    });

    // Get the genre ID for the selected genre
    const genreId = genreNameToId[normalizedGenre];
    console.log('Selected genre:', genre, 'Normalized:', normalizedGenre, 'Genre ID:', genreId); // Debug log
    
    if (!genreId) {
      console.error('Could not find genre ID for:', genre);
      return;
    }

    // Reset and update movie sections with the new genre
    setMovieSectionState(prev => {
      const newState = { ...prev };
      
      // Update only the sections that should be filtered
      ['popular-movies', 'upcoming-movies', 'top-rated-movies'].forEach(section => {
        newState[section] = {
          ...prev[section],
          page: 1,
          genre: genre.toLowerCase(),
          movies: [],
          error: null,
          hasMore: true,
          isFetching: true
        };
      });
      
      return newState;
    });

    // Fetch movies for each section with the new genre
    const fetchPromises = ['popular-movies', 'upcoming-movies', 'top-rated-movies'].map(section => {
      console.log(`Fetching ${section} with genre ID:`, genreId); // Debug log
      return fetchMoviesForSection(section, true, genreId);
    });

    Promise.all(fetchPromises)
      .catch(error => {
        console.error('Error fetching movies:', error);
        setError('Failed to fetch movies. Please try again.');
      });
  };

  const fetchMoviesForSection = async (sectionId, reset = false, genreId = null) => {
    const state = movieSectionState[sectionId];
    let endpoint = '';

    try {
      // Construct the base endpoint based on the section
      switch (sectionId) {
        case 'popular-movies':
          endpoint = `discover/movie?sort_by=popularity.desc&page=${state.page}`;
          break;
        case 'upcoming-movies':
          const today = new Date().toISOString().split('T')[0];
          endpoint = `discover/movie?sort_by=popularity.desc&primary_release_date.gte=${today}&page=${state.page}`;
          break;
        case 'top-rated-movies':
          // Use discover endpoint with vote_average sorting when filtering by genre
          if (genreId) {
            endpoint = `discover/movie?sort_by=vote_average.desc&vote_count.gte=1000&page=${state.page}`;
          } else {
            endpoint = `movie/top_rated?page=${state.page}`;
          }
          break;
        default:
          return;
      }

      // Add genre filter if a genre is selected
      if (genreId) {
        endpoint += `&with_genres=${genreId}`;
      }

      if (!TMDB_API_KEY) {
        throw new Error('TMDb API key is missing.');
      }

      console.log(`Fetching ${sectionId} with endpoint:`, endpoint); // Debug log

      const response = await fetch(`https://api.themoviedb.org/3/${endpoint}&api_key=${TMDB_API_KEY}`);
      
      if (!response.ok) {
        throw new Error(`TMDb request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid response format from TMDb API');
      }

      // Process the movies and ensure genre_ids are properly set
      const processedMovies = data.results.map(movie => ({
        ...movie,
        vote_average: movie.vote_average || 0,
        vote_count: movie.vote_count || 0,
        poster_path: movie.poster_path || '/placeholder.jpg',
        overview: movie.overview || '',
        release_date: movie.release_date || '',
        genre_ids: movie.genre_ids || []
      }));

      console.log(`Processed ${processedMovies.length} movies for ${sectionId} with genres:`, 
        processedMovies.map(m => m.genre_ids)); // Debug log

      // Update the state with the new movies
      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          movies: reset ? processedMovies : [...prev[sectionId].movies, ...processedMovies],
          page: reset ? 2 : prev[sectionId].page + 1,
          hasMore: data.page < data.total_pages,
          error: null,
          isFetching: false
        }
      }));

    } catch (err) {
      console.error(`Error fetching movies for ${sectionId}:`, err);
      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          error: err.message,
          isFetching: false,
          hasMore: false
        }
      }));
    }
  };

  const fetchBhutaneseMovies = async (query = '', pageToken = '', reset = false) => {
    const sectionId = 'bhutanese-movies';
    
    try {
      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], isFetching: true, error: null }
      }));

      // Construct a more reliable search query
      const searchTerm = query || 'bhutanese movie dzongkha';
      const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchTerm)}&type=video&key=${YOUTUBE_API_KEY}&pageToken=${pageToken}&maxResults=10&videoDuration=long&regionCode=BT`;
      
      console.log('Searching YouTube with URL:', searchURL); // Debug log
      
      const response = await fetch(searchURL);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('YouTube API Error:', errorData); // Debug log
        throw new Error(`YouTube search error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }
      
      const results = await response.json();
      console.log('YouTube Search Results:', results); // Debug log

      if (!results.items || !results.items.length) {
        setMovieSectionState(prev => ({
          ...prev,
          [sectionId]: { 
            ...prev[sectionId], 
            isFetching: false,
            hasMore: false,
            error: 'No Bhutanese movies found' 
          }
        }));
        return;
      }

      const videoIds = results.items.map(item => item.id.videoId).join(',');
      const videoDetailsURL = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
      
      console.log('Fetching video details with URL:', videoDetailsURL); // Debug log
      
      const detailsResponse = await fetch(videoDetailsURL);
      if (!detailsResponse.ok) {
        const errorData = await detailsResponse.json().catch(() => ({}));
        console.error('YouTube Details API Error:', errorData); // Debug log
        throw new Error('Failed to fetch video details');
      }
      
      const videoData = await detailsResponse.json();
      console.log('Video Details:', videoData); // Debug log

      const movies = videoData.items
        .filter(video => {
          const duration = parseYouTubeDuration(video.contentDetails.duration);
          return duration > 2400; // Only include videos longer than 40 minutes
        })
        .map(video => ({
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
        }));

      // Filter out duplicates based on video ID
      const existingIds = new Set(movieSectionState[sectionId].movies.map(movie => movie.id));
      const newMovies = movies.filter(movie => !existingIds.has(movie.id));

      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          movies: reset ? movies : [...prev[sectionId].movies, ...newMovies],
          pageToken: results.nextPageToken || '',
          searchQuery: query,
          isFetching: false,
          hasMore: !!results.nextPageToken,
          error: null
        }
      }));
    } catch (err) {
      console.error('Bhutanese Fetch Error:', err);
      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: { 
          ...prev[sectionId], 
          isFetching: false,
          hasMore: false,
          error: err.message 
        }
      }));
    }
  };

  const parseYouTubeDuration = (duration) => {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const h = match[1] ? parseInt(match[1]) : 0;
    const m = match[2] ? parseInt(match[2]) : 0;
    const s = match[3] ? parseInt(match[3]) : 0;
    return h * 3600 + m * 60 + s;
  };

  const calculateRating = (stats) => {
    if (!stats?.likeCount || !stats?.viewCount) return 'N/A';
    const likeToViewRatio = (parseInt(stats.likeCount) / parseInt(stats.viewCount)) * 10;
    return likeToViewRatio.toFixed(1);
  };

  const searchMovies = async (event) => {
    event.preventDefault();
    if (!searchQuery) return;

    try {
      if (!TMDB_API_KEY) {
        throw new Error('TMDb API key is missing');
      }

      console.log('Searching for:', searchQuery);
      const searchUrl = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(searchQuery)}&api_key=${TMDB_API_KEY}`;
      console.log('Search URL:', searchUrl);

      const res = await fetch(searchUrl);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`TMDb search error: ${res.status} - ${errorData.status_message || res.statusText}`);
      }

      const data = await res.json();
      console.log('Search results:', data);
      
      if (!data.results) {
        throw new Error('Invalid response format from TMDb API');
      }

      setSearchResults(data.results || []);
      setError('');
    } catch (err) {
      console.error('TMDb Search Error:', err);
      setError('Failed to search movies: ' + err.message);
      setSearchResults([]);
    }
  };

  const searchBhutaneseMovies = async (event) => {
    event.preventDefault();
    const sectionId = 'bhutanese-movies';
    
    try {
      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: { 
          ...prev[sectionId], 
          pageToken: '', 
          searchQuery: bhutaneseSearchQuery, 
          movies: [], 
          error: null,
          isFetching: true
        }
      }));
      
      // Construct search query with Bhutanese movie keywords
      const searchQuery = bhutaneseSearchQuery 
        ? `${bhutaneseSearchQuery} bhutanese movie dzongkha`
        : 'bhutanese movie dzongkha';
      
      await fetchBhutaneseMovies(searchQuery, '', true);
    } catch (error) {
      console.error('Error searching Bhutanese movies:', error);
      setMovieSectionState(prev => ({
        ...prev,
        [sectionId]: {
          ...prev[sectionId],
          error: error.message,
          isFetching: false
        }
      }));
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError('Invalid username or password, please try again.');
    } else {
      setShowSignIn(false);
      setError('');
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (signUpPassword !== signUpConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Validate username format (alphanumeric and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(signUpUsername)) {
      setError('Username can only contain letters, numbers, and underscores.');
      return;
    }

    // Validate username length
    if (signUpUsername.length < 3 || signUpUsername.length > 20) {
      setError('Username must be between 3 and 20 characters.');
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: signUpUsername, password: signUpPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Sign-up failed.');
        return;
      }

      const signInResult = await signIn('credentials', {
        username: signUpUsername,
        password: signUpPassword,
        redirect: false,
      });

      if (signInResult?.error) {
        setError('Sign-up succeeded, but sign-in failed.');
      } else {
        setShowSignUp(false);
        setError('');
      }
    } catch (err) {
      console.error('Sign-up error:', err);
      setError('An error occurred during sign-up.');
    }
  };

  const handleDeleteMovie = async (category, movieId) => {
    try {
      const response = await fetch('/api/movies/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          movieId: movieId.toString(),
          category: category
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete movie');
      }

      // Update the movie section state to remove the deleted movie
      setMovieSectionState(prev => ({
        ...prev,
        [category]: {
          ...prev[category],
          movies: prev[category].movies.filter(movie => movie.id.toString() !== movieId.toString())
        }
      }));

      // Refresh all user lists
      fetchUserMovies('watching', true);
      fetchUserMovies('will-watch', true);
      fetchUserMovies('already-watched', true);
    } catch (error) {
      console.error('Error deleting movie:', error);
      setError(error.message || 'Failed to delete movie');
    }
  };

  const handleAddToList = async () => {
    if (!session) {
      setError('Please sign in to add movies to your list');
      return;
    }

    if (!selectedList) {
      setError('Please select a list');
      return;
    }

    if (!selectedMovie) {
      setError('Please select a movie');
      return;
    }

    try {
      const movieData = {
        movieId: selectedMovie.id.toString(),
        title: selectedMovie.title,
        poster: selectedMovie.poster_path,
        category: selectedList,
        overview: selectedMovie.overview || '',
        releaseDate: selectedMovie.release_date || '',
        rating: selectedMovie.vote_average?.toString() || 'N/A',
        votes: selectedMovie.vote_count?.toString() || '0',
        genreIds: selectedMovie.genre_ids ? JSON.stringify(selectedMovie.genre_ids) : '[]',
        description: selectedMovie.overview || '',
        source: 'tmdb'
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
      setSelectedMovie(null);
      setSelectedList('');
      // Refresh the user's movie lists
      fetchUserMovies('watching', true);
      fetchUserMovies('will-watch', true);
      fetchUserMovies('already-watched', true);
    } catch (err) {
      console.error('Error adding movie:', err);
      setError(err.message || 'Failed to add movie to list');
    }
  };

  useEffect(() => {
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
      <div className="min-h-screen bg-black text-white flex flex-col">
        <main className="flex-1">
          {/* Header */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  MyMovieList
                </h1>
                <div className="flex items-center gap-4">
                  {session ? (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => signOut()}
                        className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setShowSignIn(true)}
                        className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => setShowSignUp(true)}
                        className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-red-500/20"
                      >
                        Sign Up
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
            {/* Search Forms */}
            <div ref={homeRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="bg-gray-900/50 p-6 rounded-xl shadow-xl border border-white/5">
                <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Search Movies
                </h2>
                <SearchBar 
                  onSearch={(query) => {
                    setSearchQuery(query);
                    searchMovies({ preventDefault: () => {} });
                  }}
                  placeholder="Search for movies..."
                />
              </div>

              <div className="bg-gray-900/50 p-6 rounded-xl shadow-xl border border-white/5">
                <h2 className="text-xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Search Bhutanese Movies
                </h2>
                <SearchBar 
                  onSearch={(query) => {
                    setBhutaneseSearchQuery(query);
                    searchBhutaneseMovies({ preventDefault: () => {} });
                  }}
                  placeholder="Search for Bhutanese movies..."
                />
              </div>
            </div>

            {/* Genre Filter */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Filter by Genre
                </h2>
                {selectedGenres.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedGenres([]);
                      setMovieSectionState((prev) => ({
                        ...prev,
                        'popular-movies': { ...prev['popular-movies'], page: 1, genre: 'all', movies: [], error: null },
                        'upcoming-movies': { ...prev['upcoming-movies'], page: 1, genre: 'all', movies: [], error: null },
                        'top-rated-movies': { ...prev['top-rated-movies'], page: 1, genre: 'all', movies: [], error: null },
                        'bhutanese-movies': { ...prev['bhutanese-movies'], pageToken: '', genre: 'all', searchQuery: '', movies: [], error: null },
                      }));
                      fetchMoviesForSection('popular-movies', true);
                      fetchMoviesForSection('upcoming-movies', true);
                      fetchMoviesForSection('top-rated-movies', true);
                      fetchBhutaneseMovies('', '', true);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(genreLookup).map(([id, name]) => (
                  <button
                    key={id}
                    onClick={() => handleGenreChange(name.toLowerCase())}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                      selectedGenres.includes(name.toLowerCase())
                        ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/20'
                        : 'bg-gray-800/50 text-white/70 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Search Results
                  </h2>
                  <button
                    onClick={() => {
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                  >
                    Clear Results
                  </button>
                </div>
                <InfiniteMovieScroll
                  movies={searchResults}
                  title=""
                  source="tmdb"
                />
              </div>
            )}

            {/* Bhutanese Movies Search Results */}
            {bhutaneseSearchQuery && movieSectionState['bhutanese-movies'].movies.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Bhutanese Movies Search Results
                  </h2>
                  <button
                    onClick={() => {
                      setBhutaneseSearchQuery('');
                      setMovieSectionState(prev => ({
                        ...prev,
                        'bhutanese-movies': {
                          ...prev['bhutanese-movies'],
                          searchQuery: '',
                          movies: [],
                          pageToken: '',
                          error: null
                        }
                      }));
                    }}
                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                  >
                    Clear Results
                  </button>
                </div>
                <InfiniteMovieScroll
                  movies={movieSectionState['bhutanese-movies'].movies}
                  title=""
                  source="youtube"
                />
              </div>
            )}

            {/* When genres are selected, show TMDB sections first */}
            {selectedGenres.length > 0 && (
              <div className="space-y-12 mb-12">
                {/* Popular Movies */}
                <div ref={popularRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['popular-movies'].movies}
                    title="Popular Movies"
                    source="tmdb"
                  />
                </div>

                {/* Top Rated Movies */}
                <div ref={topRatedRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['top-rated-movies'].movies}
                    title="Top Rated Movies"
                    source="tmdb"
                  />
                </div>

                {/* Upcoming Movies */}
                <div ref={upcomingRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['upcoming-movies'].movies}
                    title="Upcoming Movies"
                    source="tmdb"
                  />
                </div>
              </div>
            )}

            {/* User Lists - Always show these sections */}
            {session && (
              <div className="space-y-12 mb-12">
                {/* Currently Watching */}
                <div ref={watchingRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['watching'].movies}
                    title="Currently Watching"
                    category="watching"
                    onDelete={(movieId) => handleDeleteMovie('watching', movieId)}
                    source="tmdb"
                  />
                </div>

                {/* Will Watch */}
                <div ref={watchLaterRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['will-watch'].movies}
                    title="Watch Later"
                    category="will-watch"
                    onDelete={(movieId) => handleDeleteMovie('will-watch', movieId)}
                    source="tmdb"
                  />
                </div>

                {/* Already Watched */}
                <div ref={alreadyWatchedRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['already-watched'].movies}
                    title="Already Watched"
                    category="already-watched"
                    onDelete={(movieId) => handleDeleteMovie('already-watched', movieId)}
                    source="tmdb"
                  />
                </div>
              </div>
            )}

            {/* When no genres are selected, show TMDB sections after user lists */}
            {selectedGenres.length === 0 && (
              <div className="space-y-12 mb-12">
                {/* Popular Movies */}
                <div ref={popularRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['popular-movies'].movies}
                    title="Popular Movies"
                    source="tmdb"
                  />
                </div>

                {/* Top Rated Movies */}
                <div ref={topRatedRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['top-rated-movies'].movies}
                    title="Top Rated Movies"
                    source="tmdb"
                  />
                </div>

                {/* Upcoming Movies */}
                <div ref={upcomingRef}>
                  <InfiniteMovieScroll
                    movies={movieSectionState['upcoming-movies'].movies}
                    title="Upcoming Movies"
                    source="tmdb"
                  />
                </div>

                {/* Bhutanese Movies - Only show when no search is active */}
                {!bhutaneseSearchQuery && (
                  <div ref={bhutaneseMoviesRef}>
                    <InfiniteMovieScroll
                      movies={movieSectionState['bhutanese-movies'].movies}
                      title="Bhutanese Movies"
                      source="youtube"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <div className="mt-auto">
          <Footer 
            homeRef={homeRef}
            popularRef={popularRef}
            topRatedRef={topRatedRef}
            upcomingRef={upcomingRef}
            localMoviesRef={bhutaneseMoviesRef}
            watchingRef={watchingRef}
            watchLaterRef={watchLaterRef}
            alreadyWatchedRef={alreadyWatchedRef}
            onShowSignIn={() => setShowSignInModal(true)}
          />
        </div>

        {/* Sign In Modal */}
        {showSignIn && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-white/5 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Sign In
              </h2>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-white/70 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setShowSignIn(false)}
                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-red-500/20"
                  >
                    Sign In
                  </button>
                </div>
              </form>
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-900 text-white/70">Or continue with</span>
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => signIn('google', { callbackUrl: '/' })}
                    className="w-full flex items-center justify-center gap-3 px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors duration-200"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sign Up Modal */}
        {showSignUp && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-white/5 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                Sign Up
              </h2>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label htmlFor="signup-username" className="block text-sm font-medium text-white/70 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    id="signup-username"
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="block text-sm font-medium text-white/70 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    id="signup-password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-white/70 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="signup-confirm-password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />
                </div>
                {error && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => setShowSignUp(false)}
                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-red-500/20"
                  >
                    Sign Up
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Main page component
export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MainContent />
    </Suspense>
  );
}