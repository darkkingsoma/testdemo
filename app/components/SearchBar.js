'use client';

import { useState } from 'react';

export default function SearchBar({ onSearch, placeholder = "Search for movies..." }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 p-3 bg-gray-800/50 text-white rounded-lg border border-white/10 focus:border-red-500 focus:outline-none text-sm transition-all duration-300"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg hover:from-red-500 hover:to-red-600 transition-all duration-300 text-sm font-medium shadow-lg hover:shadow-red-500/20"
        >
          Search
        </button>
      </div>
    </form>
  );
} 