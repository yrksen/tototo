import { AddMovieModal } from './components/AddMovieModal';
import { FilterSidebar } from './components/FilterSidebar';
import { DarkModeToggle } from './components/DarkModeToggle';
import { LoginModal } from './components/LoginModal';
import { TiredOfScrollingModal } from './components/TiredOfScrollingModal';
import { BrowserRouter as Router, Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
const logoImage = 'https://i.imgur.com/vUiVqow.png?direct';
import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, X, Filter, Star } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { MovieCard, type Movie } from './components/MovieCard';
import { RecentMoviesCarousel } from './components/RecentMoviesCarousel';
import { SortDropdown } from './components/SortDropdown';
import { AddMovieDialog } from './components/AddMovieDialog';
import { PaginationControls } from './components/PaginationControls';
import { FaviconSetter } from './components/FaviconSetter';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { createSlug } from './utils/slugify';

type SortOption = 'dateAdded' | 'dateAddedLatest' | 'title' | 'year' | 'imdbRating' | 'userRating' | 'communityRating';

interface Comment {
  id: string;
  movieId: number;
  username: string;
  text: string;
  timestamp: number;
}

const API_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-ea58c774`;

// Generate or retrieve anonymous user ID for non-logged-in users
const getAnonymousUserId = () => {
  let anonymousId = localStorage.getItem('anonymousUserId');
  if (!anonymousId) {
    // Generate a unique ID using timestamp + random string
    anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('anonymousUserId', anonymousId);
  }
  return anonymousId;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch (error) {
        console.error('Error parsing currentUser:', error);
      }
    }
  }, []);

  return (
    <Router>
      <FaviconSetter />
      <Routes>
        <Route path="/" element={<HomePage currentUser={currentUser} setCurrentUser={setCurrentUser} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />} />
        <Route path="/movie/:title" element={<MovieDetailPage currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
        <Route path="/profile" element={<ProfilePage isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} currentUser={currentUser} setCurrentUser={setCurrentUser} />} />
        <Route path="/reset-password" element={<ResetPasswordPage isDarkMode={isDarkMode} />} />
      </Routes>
    </Router>
  );
}

function HomePage({ currentUser, setCurrentUser, isDarkMode, setIsDarkMode }: { currentUser: any, setCurrentUser: any, isDarkMode: boolean, setIsDarkMode: any }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentView, setCurrentView] = useState<'main' | 'towatch'>('main');
  const [toWatchMovies, setToWatchMovies] = useState<Movie[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  
  // New states for enhanced features
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem('sortPreference');
    return (saved as SortOption) || 'dateAdded';
  });
  const [imdbRatingRange, setImdbRatingRange] = useState<[number, number]>([0, 10]);
  const [runtimeFilter, setRuntimeFilter] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isTiredModalOpen, setIsTiredModalOpen] = useState(false);
  const [hasShownTiredModal, setHasShownTiredModal] = useState(false);
  const [isLoadingTrailers, setIsLoadingTrailers] = useState(false);
  const [trailerLoadProgress, setTrailerLoadProgress] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  
  const MOVIES_PER_PAGE_MOBILE = 12;
  const MOVIES_PER_PAGE_DESKTOP = 24;

  useEffect(() => {
    document.title = "Trash bin";
    const loadData = async () => {
      // Load all data in parallel for faster initial load
      await Promise.all([
        loadMovies(),
        loadToWatchMovies(),
        loadComments(),
        loadRatings()
      ]);
    };
    loadData();
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Save sort preference
  useEffect(() => {
    localStorage.setItem('sortPreference', sortBy);
  }, [sortBy]);

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Show "Tired of scrolling?" modal on page 10 (only on mobile)
    if (currentPage === 10 && !hasShownTiredModal && window.innerWidth < 768) {
      setIsTiredModalOpen(true);
      setHasShownTiredModal(true);
    }
  }, [currentPage, currentView, hasShownTiredModal]);

  // Check for view query parameter
  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'towatch') {
      setCurrentView('towatch');
    } else {
      setCurrentView('main');
    }
  }, [searchParams]);

  const loadToWatchMovies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/towatch`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setToWatchMovies(data.movies);
        localStorage.setItem('toWatchMovies', JSON.stringify(data.movies));
      } else {
        console.error('Error loading to watch movies:', data.error);
        loadToWatchFromLocalStorage();
      }
    } catch (error) {
      console.error('Error fetching to watch movies from backend, using localStorage:', error);
      loadToWatchFromLocalStorage();
    }
  };

  const loadToWatchFromLocalStorage = () => {
    const stored = localStorage.getItem("toWatchMovies");
    if (stored) {
      try {
        const parsedMovies = JSON.parse(stored);
        setToWatchMovies(parsedMovies);
      } catch (error) {
        console.error('Error parsing toWatchMovies:', error);
        setToWatchMovies([]);
      }
    } else {
      setToWatchMovies([]);
    }
  };

  const loadMovies = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/movies`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setMovies(data.movies);
        localStorage.setItem('movies', JSON.stringify(data.movies));
      } else {
        console.error('Error loading movies:', data.error);
        loadFromLocalStorage();
      }
    } catch (error) {
      console.error('Error fetching movies from backend, using localStorage:', error);
      loadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem("movies");
    if (stored) {
      try {
        const parsedMovies = JSON.parse(stored);
        setMovies(parsedMovies);
      } catch (error) {
        console.error('Error parsing localStorage:', error);
        setMovies([]);
      }
    } else {
      setMovies([]);
    }
  };

  const loadComments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
        localStorage.setItem('comments', JSON.stringify(data.comments));
      } else {
        console.error('Error loading comments:', data.error);
        loadCommentsFromLocalStorage();
      }
    } catch (error) {
      console.error('Error fetching comments from backend, using localStorage:', error);
      loadCommentsFromLocalStorage();
    }
  };

  const loadCommentsFromLocalStorage = () => {
    const stored = localStorage.getItem("comments");
    if (stored) {
      try {
        const parsedComments = JSON.parse(stored);
        setComments(parsedComments);
      } catch (error) {
        console.error('Error parsing comments:', error);
        setComments([]);
      }
    } else {
      setComments([]);
    }
  };

  const loadRatings = async () => {
    try {
      // Load community ratings
      const response = await fetch(`${API_BASE_URL}/ratings`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Load user's personal ratings
      let userIdentifier = '';
      if (currentUser) {
        userIdentifier = currentUser.username;
      } else {
        userIdentifier = getAnonymousUserId();
      }

      const userResponse = await fetch(`${API_BASE_URL}/user-ratings/${userIdentifier}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      let userRatings: { [key: string]: number } = {};
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success) {
          userRatings = userData.userRatings;
        }
      }
      
      if (data.success && data.averages) {
        // Merge rating data into movies
        setMovies(prevMovies => 
          prevMovies.map(m => ({
            ...m,
            communityRating: data.averages[m.id]?.average || undefined,
            ratingCount: data.averages[m.id]?.count || undefined,
            userRating: userRatings[m.id] || m.userRating
          }))
        );
        
        // Also update toWatch movies
        setToWatchMovies(prevMovies =>
          prevMovies.map(m => ({
            ...m,
            communityRating: data.averages[m.id]?.average || undefined,
            ratingCount: data.averages[m.id]?.count || undefined,
            userRating: userRatings[m.id] || m.userRating
          }))
        );
      } else {
        console.error('Error loading ratings:', data.error);
      }
    } catch (error) {
      console.error('Error fetching ratings from backend:', error);
    }
  };

  const handleGenreChange = (genre: string, checked: boolean) => {
    if (checked) {
      setSelectedGenres([...selectedGenres, genre]);
    } else {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    }
    setCurrentPage(1);
  };

  const handleClearGenres = () => {
    setSelectedGenres([]);
    setCurrentPage(1);
  };

  const handleYearChange = (year: number, checked: boolean) => {
    if (checked) {
      setSelectedYears([...selectedYears, year]);
    } else {
      setSelectedYears(selectedYears.filter((y) => y !== year));
    }
    setCurrentPage(1);
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    if (checked) {
      setSelectedTags([...selectedTags, tag]);
    } else {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    }
    setCurrentPage(1);
  };

  const handleFixRuntimes = async () => {
    const apiKey = "f9062e1";
    const targetList = currentView === 'towatch' ? toWatchMovies : movies;
    
    // Filter to only movies without runtime
    const moviesWithoutRuntime = targetList.filter(movie => !movie.runtime || movie.runtime.trim() === '');
    
    if (moviesWithoutRuntime.length === 0) {
      alert('All movies already have runtime information!');
      return;
    }
    
    if (!confirm(`This will fetch runtime information from IMDb for ${moviesWithoutRuntime.length} movies that are missing runtime data. Continue?`)) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    console.log(`🎬 Starting runtime fix for ${moviesWithoutRuntime.length} movies (out of ${targetList.length} total) in ${currentView} list`);

    for (const movie of moviesWithoutRuntime) {
      console.log(`\n📽️ Processing: "${movie.title}" (ID: ${movie.id})`);
      console.log(`   Current runtime: ${movie.runtime || 'NONE'}`);
      console.log(`   IMDb ID: ${movie.imdbId || 'NONE'}`);
      
      try {
        // Try to extract IMDb ID from the movie data
        let imdbId = movie.imdbId;
        
        // If no IMDb ID, try to search by title
        if (!imdbId) {
          console.log(`   🔍 Searching IMDb for: "${movie.title}" (${movie.year})`);
          const searchRes = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(movie.title)}&y=${movie.year}&apikey=${apiKey}`);
          const searchData = await searchRes.json();
          console.log(`   Search result:`, searchData);
          if (searchData.Response === "True") {
            imdbId = searchData.imdbID;
            console.log(`   ✓ Found IMDb ID: ${imdbId}`);
          } else {
            console.log(`   ✗ Not found on IMDb`);
            skippedCount++;
            continue;
          }
        }

        if (imdbId) {
          console.log(`   📡 Fetching details from IMDb...`);
          const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${apiKey}`);
          const data = await res.json();
          console.log(`   IMDb data:`, data);
          
          // Check if it's a series or movie
          if (data.Response === "True") {
            let runtimeValue = null;
            
            if (data.Type === "series") {
              // For series, store season and episode count
              if (data.totalSeasons && data.totalSeasons !== "N/A") {
                runtimeValue = `${data.totalSeasons} Season${data.totalSeasons !== "1" ? "s" : ""}`;
                console.log(`   📺 Series found: ${runtimeValue}`);
              }
            } else {
              // For movies, store runtime
              if (data.Runtime && data.Runtime !== "N/A") {
                runtimeValue = data.Runtime;
                console.log(`   ⏱️ Runtime found: ${runtimeValue}`);
              }
            }
            
            if (runtimeValue) {
              // Update backend for each movie individually
              try {
                const endpoint = currentView === 'towatch' ? 'towatch' : 'movies';
                const updateRes = await fetch(`${API_BASE_URL}/${endpoint}/${movie.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${publicAnonKey}`,
                  },
                  body: JSON.stringify({ runtime: runtimeValue, imdbId: imdbId }),
                });
                
                const responseText = await updateRes.text();
                console.log(`   Backend response:`, responseText);
                
                if (updateRes.ok) {
                  console.log(`   ✅ Updated runtime for "${movie.title}": ${runtimeValue}`);
                  successCount++;
                } else {
                  console.error(`   ❌ Failed to update "${movie.title}":`, responseText);
                  errorCount++;
                }
              } catch (error) {
                console.error(`   ❌ Error updating movie ${movie.id} in backend:`, error);
                errorCount++;
              }
            } else {
              console.log(`   ⚠️ No runtime/season information available from IMDb`);
              skippedCount++;
            }
          } else {
            console.log(`   ⚠️ No data available from IMDb`);
            skippedCount++;
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`   ❌ Error fetching runtime for ${movie.title}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Final Results:`);
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏭️ Skipped: ${skippedCount}`);

    // Reload data from backend to ensure we have the latest
    await loadMovies();
    await loadToWatchMovies();
    
    alert(`Runtimes updated!\nSuccess: ${successCount}\nErrors: ${errorCount}\nSkipped: ${skippedCount}`);
  };

  const handleMigrateDateAdded = async () => {
    console.log('🔄 Starting migration: Adding dateAdded timestamps to all movies...');
    
    const targetList = currentView === 'towatch' ? toWatchMovies : movies;
    let updatedCount = 0;
    
    for (const movie of targetList) {
      // Skip movies that already have dateAdded
      if (movie.dateAdded) {
        continue;
      }
      
      console.log(`✅ Adding dateAdded to movie #${movie.id}: ${movie.title}`);
      
      // Add dateAdded timestamp (use current time)
      const updatedMovie = {
        ...movie,
        dateAdded: Date.now()
      };
      
      try {
        // Update in database
        const endpoint = currentView === 'towatch' ? 'towatch' : 'movies';
        const response = await fetch(`${API_BASE_URL}/${endpoint}/${movie.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(updatedMovie),
        });
        
        if (response.ok) {
          updatedCount++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error updating movie ${movie.id}:`, error);
      }
    }
    
    console.log(`✅ Migration complete! Updated ${updatedCount} movies.`);
    console.log('🔄 Reloading movies from database...');
    
    // Reload data from backend
    await loadMovies();
    await loadToWatchMovies();
    
    alert(`Migration complete!\nUpdated ${updatedCount} movies with dateAdded timestamps.`);
    console.log('✨ Done! The "Recently Added" carousel should now work correctly.');
  };

  const handleLoadAllTrailers = async () => {
    if (!confirm('This will automatically search and add trailers from YouTube for all movies that don\'t have trailers. No API limits! This may take a few minutes. Continue?')) {
      return;
    }
    
    setIsLoadingTrailers(true);
    setTrailerLoadProgress('Starting trailer fetch...');
    
    try {
      // Calculate how many movies need trailers
      const moviesWithoutTrailers = movies.filter(m => !m.trailer || m.trailer.trim() === '');
      const totalToProcess = moviesWithoutTrailers.length;
      
      console.log('🎬 Trailer Loading Debug:');
      console.log('Total movies:', movies.length);
      console.log('Movies without trailers:', totalToProcess);
      console.log('Sample movies:', movies.slice(0, 3).map(m => ({ 
        title: m.title, 
        hasTrailer: !!m.trailer, 
        trailerValue: m.trailer 
      })));
      
      if (totalToProcess === 0) {
        alert('All movies already have trailers!');
        setIsLoadingTrailers(false);
        setTrailerLoadProgress('');
        return;
      }
      
      let processedSoFar = 0;
      let updatedTotal = 0;
      
      // Process in batches of 10 to avoid timeout
      while (processedSoFar < totalToProcess) {
        const remaining = totalToProcess - processedSoFar;
        const batchSize = Math.min(10, remaining);
        
        setTrailerLoadProgress(`Processing ${processedSoFar + 1}-${processedSoFar + batchSize} of ${totalToProcess} movies...`);
        
        const response = await fetch(`${API_BASE_URL}/movies/fetch-all-trailers?limit=${batchSize}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          console.log('Batch completed:', data.summary);
          console.log('Results sample:', data.results?.slice(0, 3));
          updatedTotal += data.summary.updated;
          processedSoFar += data.summary.processed;
          
          // If there are no more movies to process, break
          if (data.summary.remaining === 0) {
            break;
          }
        } else {
          console.error('Error fetching trailers:', data.error);
          alert(`Error: ${data.error}`);
          break;
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setTrailerLoadProgress('Reloading movies...');
      await loadMovies();
      
      setTrailerLoadProgress('');
      alert(`Trailer loading complete!\\n\\nSuccessfully added trailers to ${updatedTotal} movies.`);
      
    } catch (error) {
      console.error('Error loading trailers:', error);
      alert(`Error loading trailers: ${error}`);
      setTrailerLoadProgress('');
    } finally {
      setIsLoadingTrailers(false);
    }
  };

  const handleForceReloadAllTrailers = async () => {
    if (!confirm('⚠️ WARNING: This will RE-FETCH trailers for ALL ' + movies.length + ' movies, even those that already have trailers. This may take several minutes. Continue?')) {
      return;
    }
    
    setIsLoadingTrailers(true);
    setTrailerLoadProgress('Force reloading ALL trailers...');
    
    try {
      let processedSoFar = 0;
      let updatedTotal = 0;
      const totalToProcess = movies.length;
      
      // Process in batches of 10
      while (processedSoFar < totalToProcess) {
        const remaining = totalToProcess - processedSoFar;
        const batchSize = Math.min(10, remaining);
        
        setTrailerLoadProgress(`Force reloading ${processedSoFar + 1}-${processedSoFar + batchSize} of ${totalToProcess} movies...`);
        
        const response = await fetch(`${API_BASE_URL}/movies/fetch-all-trailers?limit=${batchSize}&force=true`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          console.log('Batch completed:', data.summary);
          console.log('Results sample:', data.results?.slice(0, 3));
          updatedTotal += data.summary.updated;
          processedSoFar += data.summary.processed;
          
          // If there are no more movies to process, break
          if (data.summary.remaining === 0) {
            break;
          }
        } else {
          console.error('Error fetching trailers:', data.error);
          alert(`Error: ${data.error}`);
          break;
        }
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setTrailerLoadProgress('Reloading movies...');
      await loadMovies();
      
      setTrailerLoadProgress('');
      alert(`Force reload complete!\\n\\nSuccessfully reloaded trailers for ${updatedTotal} movies.`);
      
    } catch (error) {
      console.error('Error force reloading trailers:', error);
      alert(`Error force reloading trailers: ${error}`);
      setTrailerLoadProgress('');
    } finally {
      setIsLoadingTrailers(false);
    }
  };

  const handleAddMovie = async (newMovie: Movie) => {
    const targetList = currentView === 'towatch' ? toWatchMovies : movies;
    const updatedMovies = [newMovie, ...targetList];
    
    if (currentView === 'towatch') {
      try {
        const response = await fetch(`${API_BASE_URL}/towatch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(newMovie),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
          setToWatchMovies(updatedMovies);
          localStorage.setItem('toWatchMovies', JSON.stringify(updatedMovies));
        } else {
          console.error('Error adding to watch movie to backend:', data.error);
          setToWatchMovies(updatedMovies);
          localStorage.setItem('toWatchMovies', JSON.stringify(updatedMovies));
        }
      } catch (error) {
        console.error('Error saving to watch movie to backend, saving to localStorage only:', error);
        setToWatchMovies(updatedMovies);
        localStorage.setItem('toWatchMovies', JSON.stringify(updatedMovies));
      }
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/movies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(newMovie),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setMovies(updatedMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMovies));
      } else {
        console.error('Error adding movie to backend:', data.error);
        setMovies(updatedMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMovies));
      }
    } catch (error) {
      console.error('Error saving movie to backend, saving to localStorage only:', error);
      setMovies(updatedMovies);
      localStorage.setItem('movies', JSON.stringify(updatedMovies));
    }
  };

  const handleMovieClick = (movie: Movie) => {
    navigate(`/movie/${createSlug(movie.title)}`);
  };

  const handleDeleteMovie = async (movieId: number) => {
    if (currentView === 'towatch') {
      const updatedMovies = toWatchMovies.filter(m => m.id !== movieId);
      
      try {
        const response = await fetch(`${API_BASE_URL}/towatch/${movieId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
          setToWatchMovies(updatedMovies);
          localStorage.setItem('toWatchMovies', JSON.stringify(updatedMovies));
        } else {
          console.error('Error deleting to watch movie from backend:', data.error);
          setToWatchMovies(updatedMovies);
          localStorage.setItem('toWatchMovies', JSON.stringify(updatedMovies));
        }
      } catch (error) {
        console.error('Error deleting to watch movie from backend, deleting from localStorage only:', error);
        setToWatchMovies(updatedMovies);
        localStorage.setItem('toWatchMovies', JSON.stringify(updatedMovies));
      }
      return;
    }
    
    const updatedMovies = movies.filter(m => m.id !== movieId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/movies/${movieId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setMovies(updatedMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMovies));
      } else {
        console.error('Error deleting movie from backend:', data.error);
        setMovies(updatedMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMovies));
      }
    } catch (error) {
      console.error('Error deleting movie from backend, deleting from localStorage only:', error);
      setMovies(updatedMovies);
      localStorage.setItem('movies', JSON.stringify(updatedMovies));
    }
  };

  const handleUpdatePoster = async (movieId: number, newImageUrl: string) => {
    const updatedMovies = movies.map(m => 
      m.id === movieId ? { ...m, image: newImageUrl } : m
    );
    
    try {
      const response = await fetch(`${API_BASE_URL}/movies/${movieId}/poster`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ image: newImageUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setMovies(updatedMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMovies));
      } else {
        console.error('Error updating poster in backend:', data.error);
        setMovies(updatedMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMovies));
      }
    } catch (error) {
      console.error('Error updating poster in backend, updating localStorage only:', error);
      setMovies(updatedMovies);
      localStorage.setItem('movies', JSON.stringify(updatedMovies));
    }
  };

  const handleUpdateRating = async (movieId: number, rating: number) => {
    const targetList = currentView === 'towatch' ? toWatchMovies : movies;
    const setTargetList = currentView === 'towatch' ? setToWatchMovies : setMovies;
    const storageKey = currentView === 'towatch' ? 'toWatchMovies' : 'movies';
    
    const updatedMovies = targetList.map(m => 
      m.id === movieId ? { ...m, userRating: rating } : m
    );
    
    setTargetList(updatedMovies);
    localStorage.setItem(storageKey, JSON.stringify(updatedMovies));
    
    // Submit rating to backend
    try {
      let userIdentifier = '';
      if (currentUser) {
        userIdentifier = currentUser.id;
      } else {
        userIdentifier = getAnonymousUserId();
      }
      
      const response = await fetch(`${API_BASE_URL}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ movieId, rating, userIdentifier }),
      });

      if (response.ok) {
        console.log('Rating submitted successfully');
      }
    } catch (error) {
      console.error('Error submitting rating to backend:', error);
    }
  };

  const handleUpdateTags = async (movieId: number, tags: string[]) => {
    const targetList = currentView === 'towatch' ? toWatchMovies : movies;
    const setTargetList = currentView === 'towatch' ? setToWatchMovies : setMovies;
    const storageKey = currentView === 'towatch' ? 'toWatchMovies' : 'movies';
    
    const updatedMovies = targetList.map(m => 
      m.id === movieId ? { ...m, tags } : m
    );
    
    setTargetList(updatedMovies);
    localStorage.setItem(storageKey, JSON.stringify(updatedMovies));
  };

  const handleUpdateRuntime = async (movieId: number, runtime: string) => {
    const targetList = currentView === 'towatch' ? toWatchMovies : movies;
    const setTargetList = currentView === 'towatch' ? setToWatchMovies : setMovies;
    const storageKey = currentView === 'towatch' ? 'toWatchMovies' : 'movies';
    
    const updatedMovies = targetList.map(m => 
      m.id === movieId ? { ...m, runtime } : m
    );
    
    setTargetList(updatedMovies);
    localStorage.setItem(storageKey, JSON.stringify(updatedMovies));
    
    // Update backend
    try {
      const endpoint = currentView === 'towatch' ? 'towatch' : 'movies';
      const response = await fetch(`${API_BASE_URL}/${endpoint}/${movieId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ runtime }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        console.error('Error updating runtime in backend:', data.error);
      }
    } catch (error) {
      console.error('Error updating runtime in backend:', error);
    }
  };

  const handleMarkAsWatched = async (movie: Movie) => {
    const maxId = movies.length > 0 ? Math.max(...movies.map(m => m.id)) : 0;
    const movieWithNewId = { ...movie, id: maxId + 1, dateAdded: Date.now() };
    
    const updatedMainMovies = [movieWithNewId, ...movies];
    const updatedToWatchMovies = toWatchMovies.filter(m => m.id !== movie.id);
    
    try {
      const addResponse = await fetch(`${API_BASE_URL}/movies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(movieWithNewId),
      });
      
      if (!addResponse.ok) {
        throw new Error(`HTTP error adding to main list! status: ${addResponse.status}`);
      }
      
      const deleteResponse = await fetch(`${API_BASE_URL}/towatch/${movie.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (!deleteResponse.ok) {
        throw new Error(`HTTP error removing from to watch! status: ${deleteResponse.status}`);
      }
      
      const addData = await addResponse.json();
      const deleteData = await deleteResponse.json();
      
      if (addData.success && deleteData.success) {
        setMovies(updatedMainMovies);
        setToWatchMovies(updatedToWatchMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMainMovies));
        localStorage.setItem('toWatchMovies', JSON.stringify(updatedToWatchMovies));
        // Navigate back to home after marking as watched
        navigate('/');
      } else {
        console.error('Error marking movie as watched:', addData.error || deleteData.error);
        setMovies(updatedMainMovies);
        setToWatchMovies(updatedToWatchMovies);
        localStorage.setItem('movies', JSON.stringify(updatedMainMovies));
        localStorage.setItem('toWatchMovies', JSON.stringify(updatedToWatchMovies));
        navigate('/');
      }
    } catch (error) {
      console.error('Error marking movie as watched in backend, updating localStorage only:', error);
      setMovies(updatedMainMovies);
      setToWatchMovies(updatedToWatchMovies);
      localStorage.setItem('movies', JSON.stringify(updatedMainMovies));
      localStorage.setItem('toWatchMovies', JSON.stringify(updatedToWatchMovies));
      navigate('/');
    }
  };

  const handleTryMyLuck = () => {
    const currentMovieList = currentView === 'towatch' ? toWatchMovies : movies;
    
    if (currentMovieList.length === 0) {
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * currentMovieList.length);
    const randomMovie = currentMovieList[randomIndex];
    
    navigate(`/movie/${createSlug(randomMovie.title)}`);
  };

  const handleAddComment = async (movieId: number, text: string) => {
    const { text: commentText, username } = JSON.parse(text);
    
    const newComment: Comment = {
      id: Date.now().toString(),
      movieId,
      text: commentText,
      username,
      timestamp: Date.now(),
    };
    
    const updatedComments = [...comments, newComment];
    
    try {
      const response = await fetch(`${API_BASE_URL}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(newComment),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setComments(updatedComments);
        localStorage.setItem('comments', JSON.stringify(updatedComments));
      } else {
        console.error('Error adding comment to backend:', data.error);
        setComments(updatedComments);
        localStorage.setItem('comments', JSON.stringify(updatedComments));
      }
    } catch (error) {
      console.error('Error saving comment to backend, saving to localStorage only:', error);
      setComments(updatedComments);
      localStorage.setItem('comments', JSON.stringify(updatedComments));
    }
  };

  const handleDeleteComment = async (movieId: number, commentId: string) => {
    const updatedComments = comments.filter(c => c.id !== commentId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/comments/${movieId}/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setComments(updatedComments);
        localStorage.setItem('comments', JSON.stringify(updatedComments));
      } else {
        console.error('Error deleting comment from backend:', data.error);
        setComments(updatedComments);
        localStorage.setItem('comments', JSON.stringify(updatedComments));
      }
    } catch (error) {
      console.error('Error deleting comment from backend, deleting from localStorage only:', error);
      setComments(updatedComments);
      localStorage.setItem('comments', JSON.stringify(updatedComments));
    }
  };

  // Get all unique tags from movies (memoized)
  const allTags = useMemo(() => 
    Array.from(
      new Set(
        (currentView === 'towatch' ? toWatchMovies : movies)
          .flatMap(m => m.tags || [])
      )
    ),
    [currentView, toWatchMovies, movies]
  );

  // Get all unique years from movies (memoized)
  const availableYears = useMemo(() => {
    const years = new Set(
      (currentView === 'towatch' ? toWatchMovies : movies)
        .map(m => m.year)
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [currentView, toWatchMovies, movies]);

  // Helper function to parse runtime string to minutes
  const parseRuntime = (runtime?: string): number => {
    if (!runtime) return 0;
    const match = runtime.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };

  // Advanced filtering (memoized)
  const filteredMovies = useMemo(() => (currentView === 'towatch' ? toWatchMovies : movies).filter((movie) => {
    // Split movie genres by comma and trim whitespace
    const movieGenres = movie.genre ? movie.genre.split(',').map(g => g.trim()) : [];
    const genreMatch = selectedGenres.length === 0 || selectedGenres.some(genre => movieGenres.includes(genre));
    
    const yearMatch = selectedYears.length === 0 || selectedYears.includes(movie.year);
    const searchMatch = 
      searchQuery === "" || 
      movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movie.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    // IMDb rating filter
    const movieRating = movie.imdbRating || movie.rating;
    const ratingMatch = movieRating >= imdbRatingRange[0] && movieRating <= imdbRatingRange[1];
    
    // Runtime filter
    let runtimeMatch = true;
    if (runtimeFilter !== 'all') {
      const runtimeMinutes = parseRuntime(movie.runtime);
      const isSeason = movie.runtime && movie.runtime.toLowerCase().includes('season');
      
      if (runtimeFilter === 'short') {
        runtimeMatch = !isSeason && runtimeMinutes > 0 && runtimeMinutes <= 90;
      } else if (runtimeFilter === 'medium') {
        runtimeMatch = !isSeason && runtimeMinutes > 90 && runtimeMinutes <= 150;
      } else if (runtimeFilter === 'long') {
        runtimeMatch = !isSeason && runtimeMinutes > 150;
      } else if (runtimeFilter === 'oneSeason') {
        runtimeMatch = isSeason && (movie.runtime.includes('1 Season') || movie.runtime === '1 Seasons');
      } else if (runtimeFilter === 'multiSeason') {
        const seasonMatch = movie.runtime?.match(/(\d+)\s+Season/);
        runtimeMatch = isSeason && seasonMatch && parseInt(seasonMatch[1]) > 1;
      }
    }
    
    // Tag filter
    const tagMatch = selectedTags.length === 0 || 
      (movie.tags && selectedTags.some(tag => movie.tags?.includes(tag)));
    
    return genreMatch && yearMatch && searchMatch && ratingMatch && runtimeMatch && tagMatch;
  }), [currentView, toWatchMovies, movies, selectedGenres, selectedYears, searchQuery, imdbRatingRange, runtimeFilter, selectedTags]);

  // Sorting logic (memoized)
  const sortedMovies = useMemo(() => [...filteredMovies].sort((a, b) => {
    switch (sortBy) {
      case 'dateAdded':
        return b.id - a.id; // Newest first
      case 'dateAddedLatest':
        return a.id - b.id; // Latest (oldest) first
      case 'title':
        return a.title.localeCompare(b.title);
      case 'year':
        return b.year - a.year;
      case 'imdbRating':
        return (b.imdbRating || b.rating) - (a.imdbRating || a.rating);
      case 'userRating':
        return (b.userRating || 0) - (a.userRating || 0);
      case 'communityRating':
        return (b.communityRating || 0) - (a.communityRating || 0);
      default:
        return 0;
    }
  }), [filteredMovies, sortBy]);

  const displayMovies = sortedMovies;

  // Pagination calculations
  const totalPagesMobile = Math.ceil(displayMovies.length / MOVIES_PER_PAGE_MOBILE);
  const totalPagesDesktop = Math.ceil(displayMovies.length / MOVIES_PER_PAGE_DESKTOP);
  const startIndexMobile = (currentPage - 1) * MOVIES_PER_PAGE_MOBILE;
  const endIndexMobile = startIndexMobile + MOVIES_PER_PAGE_MOBILE;
  const paginatedMoviesForMobile = displayMovies.slice(startIndexMobile, endIndexMobile);
  const startIndexDesktop = (currentPage - 1) * MOVIES_PER_PAGE_DESKTOP;
  const endIndexDesktop = startIndexDesktop + MOVIES_PER_PAGE_DESKTOP;
  const paginatedMoviesForDesktop = displayMovies.slice(startIndexDesktop, endIndexDesktop);

  // Get the 12 most recently added movies (by dateAdded timestamp) (memoized)
  const recentMovies = useMemo(() => [...movies]
    .sort((a, b) => b.id - a.id)
    .slice(0, 12), [movies]);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      {/* Show loading screen while initial data is loading */}
      {isLoading ? (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-black">
          <div className="flex flex-col items-center gap-4">
            {/* Spinning Logo */}
            <div className="w-16 h-16 animate-spin">
              <img src={logoImage} alt="Trash Bin Logo" className="w-full h-full" />
            </div>
            {/* Loading Text */}
            <div className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Bear with us...
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Login Modal */}
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        isDarkMode={isDarkMode}
        setCurrentUser={setCurrentUser}
      />

      {/* Tired of Scrolling Modal */}
      <TiredOfScrollingModal
        isOpen={isTiredModalOpen}
        onClose={() => setIsTiredModalOpen(false)}
        onRandomMovie={handleTryMyLuck}
        isDarkMode={isDarkMode}
      />

      {/* Header - Minimal B&W Style */}
      <div 
        className="border-b py-4 sticky top-0 z-40 md:relative backdrop-blur-sm md:backdrop-blur-none bg-background/80 dark:bg-black/80 md:bg-background md:dark:bg-black"
      >
        <div className="flex items-center justify-between gap-4 px-6">
          {/* Left side - Logo */}
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-70 transition-opacity"
            onClick={() => {
              setCurrentView('main');
              setCurrentPage(1);
            }}
          >
            <img src={logoImage} alt="Trash Bin Logo" className="size-6" />
            <h1 className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Trash Bin
            </h1>
          </div>
          
          {/* Center - Search Bar with Random */}
          <div className="absolute hidden md:flex items-center gap-4" style={{ left: 'calc(100vw / 8)', width: 'auto' }}>
            <div className="relative" style={{ width: 'calc(100vw / 8 * 3)' }}>
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 size-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
              <Input
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                  setShowSearchDropdown(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchDropdown(searchQuery.length > 0)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                className={`h-10 pl-10 pr-10 border rounded-lg ${isDarkMode ? 'bg-black text-white border-gray-800' : 'bg-white text-black border-gray-300'}`}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                    setShowSearchDropdown(false);
                  }}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-opacity hover:opacity-70 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
              
              {/* Live Search Dropdown */}
              {showSearchDropdown && searchQuery && displayMovies.length > 0 && (
                <div className={`absolute top-full left-0 right-0 mt-2 border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50 ${isDarkMode ? 'bg-black border-gray-800' : 'bg-white border-gray-300'}`}>
                  {displayMovies.slice(0, 8).map((movie) => (
                    <div
                      key={movie.id}
                      onClick={() => {
                        navigate(`/movie/${createSlug(movie.title)}`);
                        setShowSearchDropdown(false);
                      }}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${isDarkMode ? 'hover:bg-gray-900' : 'hover:bg-gray-100'} border-b last:border-b-0 ${isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
                    >
                      <ImageWithFallback 
                        src={movie.image} 
                        alt={movie.title}
                        className="w-12 h-16 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${isDarkMode ? 'text-white' : 'text-black'}`}>
                          {movie.title}
                        </div>
                        <div className={`text-xs flex items-center gap-2 mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <span>{movie.year}</span>
                          {movie.runtime && (
                            <>
                              <span>•</span>
                              <span>{movie.runtime}</span>
                            </>
                          )}
                          {movie.imdbRating && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Star className="size-3 fill-yellow-400 text-yellow-400" />
                                {movie.imdbRating.toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {displayMovies.length > 8 && (
                    <div className={`p-3 text-center text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Showing 8 of {displayMovies.length} results
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Random button */}
            <button
              onClick={handleTryMyLuck}
              className={`text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}
            >
              🎲 Random
            </button>
          </div>
          
          {/* Right side - To watch, Theme toggle and Sign in */}
          <div className="flex items-center gap-4 md:gap-6">
            
            {/* Watchlist for desktop */}
            <h1 
              className={`hidden md:block text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}
              onClick={() => {
                setCurrentView('towatch');
                setCurrentPage(1);
              }}
            >
              Watchlist
            </h1>
            
            {/* Watchlist for mobile */}
            <h1 
              className={`md:hidden text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}
              onClick={() => {
                setCurrentView('towatch');
                setCurrentPage(1);
              }}
            >
              Watchlist
            </h1>
            
            <DarkModeToggle isDark={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
            
            {currentUser ? (
              <button
                onClick={() => navigate('/profile')}
                className={`text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity tracking-tight whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                Profile
              </button>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className={`text-sm font-medium cursor-pointer hover:opacity-70 transition-opacity tracking-tight whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-black'}`}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recent Movies Navigation - Full Width */}
      <header className="border-b w-full">
        <div className="w-full">
          <RecentMoviesCarousel movies={recentMovies} onMovieClick={handleMovieClick} />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row">
        {/* Desktop Sidebar - Hidden on Mobile */}
        <div className="hidden md:block">
          <FilterSidebar
            selectedGenres={selectedGenres}
            selectedYears={selectedYears}
            onGenreChange={handleGenreChange}
            onClearGenres={handleClearGenres}
            onYearChange={handleYearChange}
            onTryMyLuck={handleTryMyLuck}
            comments={comments}
            movies={currentView === 'towatch' ? toWatchMovies : movies}
            onCommentClick={handleMovieClick}
            imdbRatingRange={imdbRatingRange}
            onImdbRatingChange={setImdbRatingRange}
            runtimeFilter={runtimeFilter}
            onRuntimeChange={setRuntimeFilter}
            selectedTags={selectedTags}
            onTagChange={handleTagChange}
            allTags={allTags}
            availableYears={availableYears}
          />
        </div>

        {/* Mobile Filter Overlay */}
        {isMobileFilterOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMobileFilterOpen(false)}
            />
            {/* Sidebar */}
            <div className={`absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] shadow-xl overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-background'}`}>
              <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-700' : ''}`}>
                <h2 className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-white' : ''}`}>Navigation panel</h2>
                <button
                  onClick={() => setIsMobileFilterOpen(false)}
                  className={`hover:opacity-70 transition-opacity ${isDarkMode ? 'text-white' : ''}`}
                  aria-label="Close filters"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="p-4">
                <FilterSidebar
                  selectedGenres={selectedGenres}
                  selectedYears={selectedYears}
                  onGenreChange={handleGenreChange}
                  onClearGenres={handleClearGenres}
                  onYearChange={handleYearChange}
                  onTryMyLuck={handleTryMyLuck}
                  comments={comments}
                  movies={currentView === 'towatch' ? toWatchMovies : movies}
                  onCommentClick={handleMovieClick}
                  imdbRatingRange={imdbRatingRange}
                  onImdbRatingChange={setImdbRatingRange}
                  runtimeFilter={runtimeFilter}
                  onRuntimeChange={setRuntimeFilter}
                  selectedTags={selectedTags}
                  onTagChange={handleTagChange}
                  allTags={allTags}
                  availableYears={availableYears}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className={`flex-1 p-4 md:p-8 ${isDarkMode ? 'text-white' : ''}`}>
          {/* Sort Dropdown for Mobile */}
          <div className="mb-4 md:hidden flex gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 size-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
              <Input
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className={`h-10 pl-10 pr-10 rounded-lg text-sm border-2 ${isDarkMode ? 'bg-black text-white border-gray-700' : 'bg-white text-black border-gray-300'}`}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>

          {/* Sort Dropdown for Desktop */}
          <div className="hidden md:flex mb-6 items-center justify-between">
            <div className="flex items-center gap-3">
              <p className={`text-sm leading-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Showing {displayMovies.length} {displayMovies.length === 1 ? 'movie' : 'movies'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <SortDropdown value={sortBy} onChange={setSortBy} />
              <AddMovieDialog 
                onAddMovie={handleAddMovie} 
                existingMovies={[...movies, ...toWatchMovies]}
                currentViewMovies={currentView === 'towatch' ? toWatchMovies : movies}
              />
            </div>
          </div>

          {/* Mobile Filter Button */}
          <div className="mb-4 md:hidden">
            <div className="flex gap-2">
              <Button
                onClick={() => setIsMobileFilterOpen(true)}
                size="lg"
                className={`flex-1 justify-center gap-2 text-sm border-2 ${isDarkMode ? 'bg-black text-white border-gray-700 hover:bg-gray-900' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
              >
                <Filter className="size-4" />
                Navigation panel
                {(selectedGenres.length > 0 || selectedYears.length > 0) && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {selectedGenres.length + selectedYears.length}
                  </span>
                )}
              </Button>
              
              {/* Add Movie Button for Mobile */}
              <AddMovieDialog 
                onAddMovie={handleAddMovie} 
                existingMovies={[...movies, ...toWatchMovies]}
                currentViewMovies={currentView === 'towatch' ? toWatchMovies : movies}
              />
              
              {/* Reset Filters Button */}
              {(selectedGenres.length > 0 || selectedYears.length > 0 || searchQuery !== "" || selectedTags.length > 0 || imdbRatingRange[0] !== 0 || imdbRatingRange[1] !== 10 || runtimeFilter !== 'all') && (
                <Button
                  onClick={() => {
                    setSelectedGenres([]);
                    setSelectedYears([]);
                    setSearchQuery("");
                    setSelectedTags([]);
                    setImdbRatingRange([0, 10]);
                    setRuntimeFilter('all');
                    setCurrentPage(1);
                  }}
                  size="lg"
                  className={`px-4 border-2 ${isDarkMode ? 'bg-black text-white border-gray-700 hover:bg-gray-900' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {displayMovies.length > 0 ? (
            <>
              {/* Showing movies count for Mobile */}
              <div className="md:hidden mb-4">
                <p className={`text-sm leading-normal ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Showing {displayMovies.length} {displayMovies.length === 1 ? 'movie' : 'movies'}
                </p>
              </div>

              {/* Movie Grid */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-6 max-w-[2400px]">
                {/* Mobile: Show paginated movies */}
                <div className="contents md:hidden">
                  {paginatedMoviesForMobile.map((movie) => (
                    <MovieCard 
                      key={movie.id} 
                      movie={movie} 
                      onClick={() => handleMovieClick(movie)}
                      onDelete={handleDeleteMovie}
                    />
                  ))}
                </div>
                
                {/* Desktop: Show paginated movies */}
                <div className="contents hidden md:contents">
                  {paginatedMoviesForDesktop.map((movie) => (
                    <MovieCard 
                      key={movie.id} 
                      movie={movie} 
                      onClick={() => handleMovieClick(movie)}
                      onDelete={handleDeleteMovie}
                    />
                  ))}
                </div>
              </div>

              {/* Mobile Pagination Controls */}
              {totalPagesMobile > 1 && (
                <div className="md:hidden">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPagesMobile}
                    onPageChange={setCurrentPage}
                    variant="mobile"
                  />
                </div>
              )}

              {/* Desktop Pagination Controls */}
              {totalPagesDesktop > 1 && (
                <div className="hidden md:block">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPagesDesktop}
                    onPageChange={setCurrentPage}
                    variant="desktop"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <Search className={`size-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
              <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                No movies found
              </h3>
              <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                Try adjusting your filters to see more results
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="flex items-center justify-between px-6 py-[14px]">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="Trash Bin Logo" className="size-6" />
            <h1 className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Trash Bin
            </h1>
          </div>
          <button
            onClick={() => {
              const subject = encodeURIComponent('Contact Trash Bin');
              const body = encodeURIComponent('Enter your message here...');
              window.location.href = `mailto:wannabenargail@gmail.com?subject=${subject}&body=${body}`;
            }}
            className={`text-sm cursor-pointer hover:opacity-70 transition-opacity ${isDarkMode ? 'text-white/70' : 'text-gray-700'}`}
          >
            Contact
          </button>
          <span className={`text-sm ${isDarkMode ? 'text-white/70' : 'text-gray-700'}`}>
            © {new Date().getFullYear()} All rights reserved
          </span>
        </div>
      </footer>
        </>
      )}
    </div>
  );
}