'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';

export default function BhutaneseMoviePage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const [movie, setMovie] = useState(null);
  const [youtubeComments, setYoutubeComments] = useState([]);
  const [ourComments, setOurComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [selectedList, setSelectedList] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  const router = useRouter();

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${id}&key=${YOUTUBE_API_KEY}`
        );
        if (!response.ok) throw new Error('Failed to fetch movie details');
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          const video = data.items[0];
          setMovie({
            id: video.id,
            title: video.snippet.title,
            description: video.snippet.description,
            publishedAt: video.snippet.publishedAt,
            viewCount: video.statistics.viewCount,
            likeCount: video.statistics.likeCount,
            thumbnail: video.snippet.thumbnails.high.url
          });
        }
      } catch (err) {
        setError('Failed to load movie details');
        console.error('Error fetching movie:', err);
      }
    };

    const fetchYoutubeComments = async () => {
      try {
        console.log('Fetching YouTube comments for video:', id);
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${id}&key=${YOUTUBE_API_KEY}&maxResults=50&order=relevance`
        );
        
        if (!response.ok) {
          let errorMessage = `HTTP error! status: ${response.status}`;
          try {
            const errorData = await response.json();
            console.error('YouTube API Error Response:', {
              status: response.status,
              statusText: response.statusText,
              error: errorData
            });
            
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError);
            errorMessage = `Failed to fetch comments: ${response.statusText}`;
          }
          
          // Check for specific error cases
          if (response.status === 403) {
            throw new Error('YouTube API quota exceeded or API key is invalid');
          } else if (response.status === 404) {
            throw new Error('Video not found or comments are disabled');
          } else {
            throw new Error(errorMessage);
          }
        }
        
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          throw new Error('Failed to parse YouTube API response');
        }
        
        console.log('YouTube comments response:', data);
        
        if (data.items) {
          const formattedComments = data.items.map(item => ({
            id: item.id,
            author: item.snippet.topLevelComment.snippet.authorDisplayName,
            authorImage: item.snippet.topLevelComment.snippet.authorProfileImageUrl,
            text: item.snippet.topLevelComment.snippet.textDisplay,
            publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
            likeCount: item.snippet.topLevelComment.snippet.likeCount,
            replyCount: item.snippet.totalReplyCount || 0
          }));
          setYoutubeComments(formattedComments);
        } else {
          console.log('No comments found in response');
          setYoutubeComments([]);
        }
      } catch (err) {
        console.error('Error fetching YouTube comments:', err);
        setError(`Failed to load YouTube comments: ${err.message}`);
        setYoutubeComments([]);
      }
    };

    const fetchOurComments = async () => {
      try {
        const response = await fetch(`/api/comments?videoId=${id}`);
        if (!response.ok) throw new Error('Failed to fetch comments');
        const data = await response.json();
        setOurComments(data);
      } catch (err) {
        console.error('Error fetching our comments:', err);
        setError(`Failed to load comments: ${err.message}`);
        setOurComments([]);
      }
    };

    fetchMovieDetails();
    fetchYoutubeComments();
    fetchOurComments();
  }, [id, YOUTUBE_API_KEY]);

  const handleAddToList = async () => {
    if (!session) {
      setError('Please sign in to add movies to your list');
      return;
    }

    if (!selectedList) {
      setError('Please select a list');
      return;
    }

    try {
      console.log('Adding YouTube movie to list:', {
        id: movie.id,
        title: movie.title,
        category: selectedList
      });

      const movieData = {
        movieId: movie.id,
        title: movie.title,
        poster: movie.thumbnail,
        category: selectedList,
        overview: movie.description || '',
        releaseDate: movie.publishedAt || '',
        rating: movie.likeCount ? (parseInt(movie.likeCount) / parseInt(movie.viewCount) * 10).toFixed(1) : 'N/A',
        votes: movie.viewCount || '0',
        genreIds: '[]',
        description: movie.description || '',
        source: 'youtube'
      };

      console.log('Sending movie data:', movieData);

      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movieData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Add to list error:', data);
        throw new Error(data.error || 'Failed to add movie to list');
      }
      
      console.log('Successfully added movie:', data);
      setSuccess(`Added to ${selectedList} list successfully!`);
      setError('');
    } catch (err) {
      console.error('Error adding movie:', err);
      setError(err.message || 'Failed to add movie to list');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!session) {
      setError('Please sign in to comment');
      return;
    }

    if (!newComment.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: id,
          text: newComment,
          authorName: session.user.name || 'Anonymous',
          source: 'youtube'
        }),
      });

      if (!response.ok) throw new Error('Failed to add comment');
      
      const newCommentData = {
        id: Date.now().toString(),
        author: session.user.name || 'Anonymous',
        text: newComment,
        publishedAt: new Date().toISOString()
      };
      
      setOurComments(prev => [newCommentData, ...prev]);
      setNewComment('');
      setError('');
    } catch (err) {
      setError('Failed to add comment');
      console.error('Error adding comment:', err);
    }
  };

  if (!movie) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 px-4 py-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
        >
          ← Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video Section */}
          <div className="lg:col-span-2">
            <div className="aspect-video w-full bg-gray-900 rounded-lg overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${id}`}
                title={movie.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
            
            <h1 className="text-3xl font-bold mt-4">{movie.title}</h1>
            
            <div className="flex items-center gap-4 mt-2 text-gray-400">
              <span>{new Date(movie.publishedAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>{parseInt(movie.viewCount).toLocaleString()} views</span>
              <span>•</span>
              <span>{parseInt(movie.likeCount).toLocaleString()} likes</span>
            </div>

            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Description</h2>
              <p className="text-gray-300 whitespace-pre-wrap">{movie.description}</p>
            </div>
          </div>

          {/* Add to List Section */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Add to Your List</h2>
              {session ? (
                <>
                  <select
                    value={selectedList}
                    onChange={(e) => setSelectedList(e.target.value)}
                    className="w-full p-2 mb-4 bg-gray-800 text-white rounded border border-gray-700 focus:border-red-500 focus:outline-none"
                  >
                    <option value="">Select a list</option>
                    <option value="watching">Watching</option>
                    <option value="will-watch">Will Watch</option>
                    <option value="already-watched">Already Watched</option>
                  </select>
                  <button
                    onClick={handleAddToList}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Add to List
                  </button>
                </>
              ) : (
                <p className="text-gray-400">Please sign in to add movies to your list</p>
              )}
              {error && <p className="text-red-500 mt-2">{error}</p>}
              {success && <p className="text-green-500 mt-2">{success}</p>}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">YouTube Comments</h2>
          
          {/* YouTube Comments List */}
          <div className="space-y-4 mb-8">
            {youtubeComments.map((comment) => (
              <div key={comment.id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <img
                    src={comment.authorImage}
                    alt={comment.author}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{comment.author}</span>
                      <span className="text-gray-400 text-sm">
                        {new Date(comment.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div 
                      className="text-gray-300"
                      dangerouslySetInnerHTML={{ __html: comment.text }}
                    />
                    <div className="mt-2 flex items-center gap-4 text-gray-400 text-sm">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                        {comment.likeCount}
                      </span>
                      {comment.replyCount > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {youtubeComments.length === 0 && (
              <p className="text-gray-400 text-center py-4">No YouTube comments yet.</p>
            )}
          </div>

          {/* Our Comments Section */}
          <h2 className="text-2xl font-bold mb-4">MyMovieList Comments</h2>
          
          {/* Add Comment Form */}
          {session && (
            <form onSubmit={handleAddComment} className="mb-6">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="w-full p-3 bg-gray-900 text-white rounded border border-gray-700 focus:border-red-500 focus:outline-none"
                rows="3"
              ></textarea>
              <button
                type="submit"
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Post Comment
              </button>
            </form>
          )}

          {/* Our Comments List */}
          <div className="space-y-4">
            {ourComments.map((comment) => (
              <div key={comment.id} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                    <span className="text-lg font-semibold">
                      {comment.author ? comment.author.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{comment.author}</span>
                      <span className="text-gray-400 text-sm">
                        {new Date(comment.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-300">{comment.text}</p>
                  </div>
                </div>
              </div>
            ))}
            {ourComments.length === 0 && (
              <p className="text-gray-400 text-center py-4">No comments yet. Be the first to comment!</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 