import { Movie } from "./MovieCard";
import { Star } from "lucide-react";
import { useState, useEffect } from "react";

interface RecentMoviesCarouselProps {
  movies: Movie[];
  onMovieClick?: (movie: Movie) => void;
}

export function RecentMoviesCarousel({ movies, onMovieClick }: RecentMoviesCarouselProps) {
  // Get the 12 most recently added movies
  const recentMovies = movies.slice(0, 12);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(8);
  const [containerWidth, setContainerWidth] = useState('1596px');

  // Calculate how many tiles fit on screen
  useEffect(() => {
    const calculateVisibleCount = () => {
      if (window.innerWidth < 768) {
        setVisibleCount(4); // Mobile
        setContainerWidth('100%');
      } else {
        // Desktop: calculate based on available width
        // Max container width is 2400px, with 32px total padding (16px each side)
        const availableWidth = Math.min(window.innerWidth - 32, 2400);
        // Each tile is 180px + 16px gap
        const tilesCount = Math.floor((availableWidth + 16) / 196);
        const count = Math.max(6, Math.min(12, tilesCount));
        setVisibleCount(count);
        // Set exact width to show complete tiles only: (tiles * 180px) + (gaps * 16px)
        const exactWidth = (count * 180) + ((count - 1) * 16);
        setContainerWidth(`${exactWidth}px`);
      }
    };

    calculateVisibleCount();
    window.addEventListener('resize', calculateVisibleCount);
    return () => window.removeEventListener('resize', calculateVisibleCount);
  }, []);

  // Auto-slide every 5 seconds for both mobile and desktop
  useEffect(() => {
    if (!recentMovies.length) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const maxIndex = recentMovies.length - visibleCount;
        if (prev >= maxIndex) {
          return 0;
        }
        return prev + 1;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [recentMovies.length, visibleCount]);

  if (!recentMovies.length) return null;

  return (
    <div className="w-full flex justify-center">
      {/* Desktop: Dynamic number of movies based on screen width */}
      <div className="hidden md:block px-4 py-2 w-full max-w-[2400px]">
        <div className="flex justify-center">
          <div className="relative overflow-hidden" style={{ width: containerWidth, maxWidth: '100%' }}>
            <div 
              className="flex gap-4 transition-transform duration-700 ease-in-out"
              style={{
                transform: `translateX(-${currentIndex * 196}px)`
              }}
            >
              {recentMovies.map((movie) => (
                <div
                  key={movie.id}
                  className="flex-shrink-0 w-[180px] rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => onMovieClick?.(movie)}
                >
                  <img
                    src={movie.image}
                    alt={movie.title}
                    className="w-full h-[270px] object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Show 4 movies with horizontal sliding */}
      <div className="md:hidden px-3 py-2">
        <div className="relative overflow-hidden">
          <div 
            className="flex gap-3 transition-transform duration-700 ease-in-out"
            style={{
              transform: `translateX(calc(-${currentIndex} * (25% + 3px)))`
            }}
          >
            {recentMovies.map((movie) => (
              <div
                key={movie.id}
                className="flex-shrink-0 rounded-lg shadow overflow-hidden cursor-pointer"
                style={{ width: 'calc(25% - 9px)' }}
                onClick={() => onMovieClick?.(movie)}
              >
                <img
                  src={movie.image}
                  alt={movie.title}
                  className="w-full h-[140px] object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}