export default function GenreFilter({ onGenreChange, selectedGenre }) {
    const genres = [
      "all",
      "action",
      "adventure",
      "animation",
      "comedy",
      "crime",
      "documentary",
      "drama",
      "family",
      "fantasy",
      "biography",
      "horror",
      "mystery",
      "romance",
      "sci-fi",
      "thriller",
      "other",
    ];
  
    return (
      <div className="mb-4">
        <label htmlFor="genre-select" className="text-light-text mr-2">
          Filter by Genre:
        </label>
        <select
          id="genre-select"
          value={selectedGenre}
          onChange={(e) => onGenreChange(e.target.value)}
          className="p-2 bg-gray-900 text-white rounded-md border border-gray-700 hover:bg-gray-800 focus:bg-gray-800 focus:border-red-500 focus:outline-none transition-colors duration-200"
        >
          {genres.map((genre) => (
            <option key={genre} value={genre} className="bg-gray-900 text-white">
              {genre.charAt(0).toUpperCase() + genre.slice(1)}
            </option>
          ))}
        </select>
      </div>
    );
  }