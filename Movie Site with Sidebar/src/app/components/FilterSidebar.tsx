import { Separator } from "./ui/separator";
import { Check, Sparkles, MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import type { Movie } from "./MovieCard";
import type { Comment } from "./MovieDetailDialog";

interface FilterSidebarProps {
  selectedGenres: string[];
  selectedYears: number[];
  onGenreChange: (genre: string, checked: boolean) => void;
  onClearGenres?: () => void;
  onYearChange: (year: number, checked: boolean) => void;
  onTryMyLuck?: () => void;
  comments?: Comment[];
  movies?: Movie[];
  onCommentClick?: (movie: Movie) => void;
  imdbRatingRange?: [number, number];
  onImdbRatingChange?: (range: [number, number]) => void;
  runtimeFilter?: string;
  onRuntimeChange?: (runtime: string) => void;
  selectedTags?: string[];
  onTagChange?: (tag: string, checked: boolean) => void;
  allTags?: string[];
  availableYears?: number[];
}

const genres = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Short",
  "Sport",
  "Thriller",
  "War",
];

// Generate years from 2025 to 1970
const years = Array.from({ length: 2025 - 1970 + 1 }, (_, i) => 2025 - i);

export function FilterSidebar({
  selectedGenres,
  selectedYears,
  onGenreChange,
  onClearGenres,
  onYearChange,
  onTryMyLuck,
  comments,
  movies,
  onCommentClick,
  imdbRatingRange,
  onImdbRatingChange,
  runtimeFilter,
  onRuntimeChange,
  selectedTags,
  onTagChange,
  allTags,
  availableYears,
}: FilterSidebarProps) {
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

  // Use availableYears if provided, otherwise use the default range
  const displayYears = availableYears && availableYears.length > 0 ? availableYears : years;

  return (
    <aside className="w-full md:w-64 md:border-r p-6" style={{ background: 'transparent' }}>
      <h2 className="text-sm font-bold tracking-tight mb-6 hidden md:block dark:text-white">Navigation panel</h2>

      <div className="mb-6">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-3 dark:text-white opacity-60">Year</h3>
        <div className="relative">
          <button
            onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
            className="w-full px-3 py-2 text-xs text-left border-2 rounded-md bg-background dark:bg-gray-700 dark:text-white dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            {selectedYears.length > 0
              ? `${selectedYears.length} year${selectedYears.length > 1 ? 's' : ''} selected`
              : 'Select years'}
          </button>
          
          {isYearDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsYearDropdownOpen(false)}
              />
              <div className="absolute z-20 mt-1 w-full bg-background dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-lg max-h-[200px] overflow-y-auto p-2">
                <div className="grid grid-cols-4 gap-1">
                  {displayYears.map((year) => {
                    const isSelected = selectedYears.includes(year);
                    return (
                      <button
                        key={year}
                        onClick={() => {
                          onYearChange(year, !isSelected);
                        }}
                        className={`relative py-2 px-2 text-xs rounded transition-colors ${
                          isSelected
                            ? 'bg-gray-700 dark:bg-blue-600 text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {isSelected && (
                          <Check className="absolute left-1 top-1/2 -translate-y-1/2 size-3" />
                        )}
                        <span className={isSelected ? 'ml-3' : ''}>
                          {year}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Separator className="my-6 dark:bg-gray-600" />

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide dark:text-white opacity-60">Genre</h3>
          {onClearGenres && selectedGenres.length > 0 && (
            <button
              onClick={onClearGenres}
              className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              aria-label="Clear all genres"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => onGenreChange(genre, !selectedGenres.includes(genre))}
              className={`text-xs text-left transition-colors py-1 ${
                selectedGenres.includes(genre)
                  ? "text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:text-blue-400"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* IMDb Rating Range Filter */}
      {onImdbRatingChange && imdbRatingRange && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-3 dark:text-white opacity-60">IMDb Rating</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>{imdbRatingRange[0].toFixed(1)}+</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={imdbRatingRange[0]}
                onChange={(e) => onImdbRatingChange([parseFloat(e.target.value), 10])}
                className="w-full"
              />
            </div>
          </div>
        </>
      )}

      {/* Runtime Filter */}
      {onRuntimeChange && runtimeFilter !== undefined && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-3 dark:text-white opacity-60">Runtime</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('short')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'short' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Short (≤ 90 min)
                </button>
                {runtimeFilter === 'short' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('medium')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'medium' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Medium (90-150 min)
                </button>
                {runtimeFilter === 'medium' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('long')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'long' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Long (≥ 150 min)
                </button>
                {runtimeFilter === 'long' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('oneSeason')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'oneSeason' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  1 Season
                </button>
                {runtimeFilter === 'oneSeason' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onRuntimeChange('multiSeason')}
                  className={`flex-1 text-xs text-left py-1 px-2 rounded transition-colors ${
                    runtimeFilter === 'multiSeason' ? 'bg-blue-100 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  More than 1 Season
                </button>
                {runtimeFilter === 'multiSeason' && (
                  <button
                    onClick={() => onRuntimeChange('all')}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tag Filter */}
      {onTagChange && allTags && allTags.length > 0 && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-3 dark:text-white opacity-60">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagChange(tag, !selectedTags?.includes(tag))}
                  className={`text-xs px-2 py-1 rounded-full transition-colors ${
                    selectedTags?.includes(tag)
                      ? 'bg-purple-100 dark:bg-purple-600 text-purple-700 dark:text-white border-2 border-purple-400 font-medium'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top Rated Section */}
      {movies && movies.length > 0 && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-3 dark:text-white opacity-60">Top Rated (Your Ratings)</h3>
            <div className="space-y-2">
              {movies
                .filter(m => m.userRating && m.userRating > 0)
                .sort((a, b) => (b.userRating || 0) - (a.userRating || 0))
                .slice(0, 5)
                .map((movie) => (
                  <button
                    key={movie.id}
                    onClick={() => onCommentClick && onCommentClick(movie)}
                    className="w-full text-left bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600 p-2 rounded-lg border dark:border-gray-600 transition-colors"
                  >
                    <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">
                      {movie.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-bold">★ {movie.userRating}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({movie.year})</span>
                    </div>
                  </button>
                ))}
              {movies.filter(m => m.userRating && m.userRating > 0).length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">No rated movies yet</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Recent Comments Section */}
      {comments && movies && onCommentClick && comments.length > 0 && (
        <>
          <Separator className="my-6 dark:bg-gray-600" />
          <div className="mb-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide mb-3 dark:text-white opacity-60">Recent Comments</h3>
            <div className="space-y-3">
              {comments
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 5)
                .map((comment) => {
                  const movie = movies.find(m => m.id === comment.movieId);
                  if (!movie) return null;
                  
                  // Truncate comment to first 6 words if longer
                  const words = comment.text.split(' ');
                  const displayText = words.length > 6 
                    ? words.slice(0, 6).join(' ') + '...'
                    : comment.text;
                  
                  return (
                    <button
                      key={comment.id}
                      onClick={() => onCommentClick(movie)}
                      className="w-full text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 p-3 rounded-lg transition-colors"
                    >
                      <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">
                        {movie.title} - {movie.year}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        {displayText}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{comment.username}</span>
                        <span>
                          {new Date(comment.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}