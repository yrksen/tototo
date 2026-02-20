import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

// Override console.error to filter out unavoidable connection noise
const originalConsoleError = console.error;
console.error = (...args) => {
  // Convert all args to strings for checking
  const msg = args.map(arg => 
    typeof arg === 'object' ? (arg?.message || arg?.name || String(arg)) : String(arg)
  ).join(" ");

  // Filter out known connection-closed errors
  if (
    msg.includes("Http: connection closed") ||
    msg.includes("connection closed before message completed") ||
    msg.includes("broken pipe") ||
    msg.includes("network error") ||
    msg.includes("EPIPE")
  ) {
    return;
  }
  
  // Also check specifically for the Http error object structure
  if (args.length > 0 && typeof args[0] === 'object') {
     const err = args[0] as any;
     if (err?.name === "Http" || (err?.stack && err.stack.includes("ext:runtime/01_http.js"))) {
       return;
     }
  }

  originalConsoleError(...args);
};

// Suppress "Http: connection closed before message completed" errors
// These occur when the client disconnects while the server is sending a response.
// This is a normal occurrence in web servers but Deno logs it as an unhandled rejection.
globalThis.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason;
  
  // Check if it's a connection-related error
  const reasonStr = String(reason);
  const stackStr = reason?.stack || "";
  
  const isConnectionIssue = 
    reason?.name === "Http" || 
    reasonStr.includes("connection closed") || 
    reasonStr.includes("broken pipe") ||
    reasonStr.includes("network error") ||
    reason?.code === "EPIPE" ||
    stackStr.includes("ext:runtime/01_http.js") ||
    stackStr.includes("respondWith");

  if (isConnectionIssue) {
    e.preventDefault();
  }
});

// Also catch "error" events which might fire for low-level runtime errors
globalThis.addEventListener("error", (e) => {
  const error = e.error;
  const errorStr = String(error);
  
  const isConnectionIssue = 
    error?.name === "Http" || 
    errorStr.includes("connection closed") || 
    errorStr.includes("broken pipe") ||
    errorStr.includes("network error");
    
  if (isConnectionIssue) {
    e.preventDefault();
  }
});

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-ea58c774/health", (c) => {
  if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
  return c.json({ status: "ok" });
});

// Fix all movie plots from IMDb
app.post("/make-server-ea58c774/movies/fix-plots", async (c) => {
  try {
    console.log('📚 Starting plot fix for all movies...');
    
    // Get limit from query params (default to 10 movies at a time to avoid timeout)
    const url = new URL(c.req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    const movies = await kv.getByPrefix("movie:");
    console.log(`Found ${movies.length} movies total, processing ${limit} at a time`);
    
    const apiKey = "f9062e1"; // OMDb API key
    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Find movies that need plot updates (either no plot or short plot)
    const moviesToUpdate = movies.filter(m => 
      m.imdbId && (!m.plot || m.plot.length < 100 || m.plot === "N/A")
    ).slice(0, limit); // Only process the first 'limit' movies
    
    console.log(`Processing ${moviesToUpdate.length} movies that need plot updates`);
    
    // Process each movie
    for (const movie of moviesToUpdate) {
      // Stop if client disconnected
      if (c.req.raw.signal.aborted) {
        console.log('Client disconnected during plot fix');
        break;
      }
      try {
        console.log(`Fetching plot for: ${movie.title} (${movie.imdbId})`);
        // Fetch full plot from OMDb
        const res = await fetch(`https://www.omdbapi.com/?i=${movie.imdbId}&plot=full&apikey=${apiKey}`);
        const data = await res.json();
        
        if (data.Response === "True" && data.Plot && data.Plot !== "N/A") {
          // Update movie with full plot
          const updatedMovie = { ...movie, plot: data.Plot };
          await kv.set(`movie:${movie.id}`, updatedMovie);
          updatedCount++;
          console.log(`✅ Updated plot for: ${movie.title}`);
        } else {
          console.log(`⚠️ No plot available for: ${movie.title}`);
          skippedCount++;
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Error fetching plot for ${movie.title}:`, error);
        errorCount++;
      }
    }
    
    const moviesNeedingUpdate = movies.filter(m => 
      m.imdbId && (!m.plot || m.plot.length < 100 || m.plot === "N/A")
    ).length;
    
    console.log(`📊 Plot fix complete: ${updatedCount} updated, ${errorCount} errors, ${skippedCount} skipped`);
    
    if (c.req.raw.signal.aborted) {
      console.log('Client disconnected, not sending response');
      return new Response(null, { status: 499 });
    }

    return c.json({ 
      success: true, 
      updated: updatedCount,
      errors: errorCount,
      skipped: skippedCount,
      remaining: moviesNeedingUpdate - moviesToUpdate.length,
      hasMore: moviesNeedingUpdate > moviesToUpdate.length
    });
  } catch (error) {
    console.error("❌ Error fixing movie plots:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Fetch trailer for a movie from YouTube using YouTube Data API
app.post("/make-server-ea58c774/movies/:id/fetch-trailer", async (c) => {
  try {
    const id = c.req.param("id");
    console.log(`🎬 Fetching trailer for movie ID: ${id}`);
    
    // Get the movie
    const movie = await kv.get(`movie:${id}`);
    if (!movie) {
      return c.json({ success: false, error: "Movie not found" }, 404);
    }
    
    let trailerUrl = null;
    let source = 'youtube-embed';
    
    // First, try to get trailer from IMDb if we have an IMDb ID
    if (movie.imdbId) {
      console.log(`Checking IMDb for trailer: ${movie.imdbId}`);
      try {
        // Try to fetch the IMDb page and look for trailer links
        const imdbPageUrl = `https://www.imdb.com/title/${movie.imdbId}/`;
        const response = await fetch(imdbPageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Look for YouTube trailer links in the IMDb page
          // IMDb often embeds YouTube trailers
          const youtubeMatch = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
          const youtubeEmbedMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
          
          if (youtubeMatch && youtubeMatch[1]) {
            trailerUrl = `https://www.youtube.com/watch?v=${youtubeMatch[1]}`;
            source = 'imdb-youtube';
            console.log(`  ✅ Found YouTube trailer from IMDb: ${trailerUrl}`);
          } else if (youtubeEmbedMatch && youtubeEmbedMatch[1]) {
            trailerUrl = `https://www.youtube.com/watch?v=${youtubeEmbedMatch[1]}`;
            source = 'imdb-youtube';
            console.log(`  ✅ Found YouTube trailer from IMDb: ${trailerUrl}`);
          } else {
            console.log(`  ⚠️ No YouTube trailer found on IMDb page`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️ Error checking IMDb, will use YouTube search:`, error.message);
      }
    }
    
    // If no trailer found from IMDb, use YouTube embed search as fallback
    if (!trailerUrl) {
      console.log('Using YouTube embed search as fallback');
      const searchQuery = `${movie.title} ${movie.year || ''} official trailer`;
      console.log(`Creating YouTube embed search for: ${searchQuery}`);
      
      const encodedQuery = encodeURIComponent(searchQuery);
      trailerUrl = `https://www.youtube.com/embed?listType=search&list=${encodedQuery}`;
      source = 'youtube-embed';
    }
    
    console.log(`Created trailer URL: ${trailerUrl} (source: ${source})`);
    
    // Update the movie with the trailer URL
    movie.trailer = trailerUrl;
    await kv.set(`movie:${id}`, movie);
    
    if (c.req.raw.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    return c.json({ 
      success: true, 
      trailerUrl,
      source,
      title: movie.title
    });
  } catch (error) {
    console.error("Error fetching trailer:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Batch fetch trailers for all movies
app.post("/make-server-ea58c774/movies/fetch-all-trailers", async (c) => {
  try {
    console.log('🎬 Starting batch trailer fetch for all movies...');
    
    // Get limit from query params (default to 10 movies at a time to avoid timeout)
    const url = new URL(c.req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const force = url.searchParams.get('force') === 'true';
    console.log('Limit:', limit, 'Force:', force);
    
    const movies = await kv.getByPrefix("movie:");
    console.log(`Found ${movies.length} movies total, processing ${limit} at a time`);
    
    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Find movies that need trailers (either no trailer or empty, or force=true for all)
    const moviesToUpdate = movies.filter(m => 
      force || !m.trailer || m.trailer.trim() === ''
    ).slice(0, limit);
    
    console.log(`Processing ${moviesToUpdate.length} movies that need trailers`);
    
    const results = [];
    
    for (const movie of moviesToUpdate) {
      // Stop if client disconnected
      if (c.req.raw.signal.aborted) {
        console.log('Client disconnected during trailer fetch');
        break;
      }
      try {
        const searchQuery = `${movie.title} ${movie.year || ''} official trailer`;
        console.log(`Processing: ${movie.title}`);
        
        let trailerUrl = null;
        let source = 'youtube-embed';
        
        // First, try to get trailer from IMDb if we have an IMDb ID
        if (movie.imdbId) {
          console.log(`  Checking IMDb for trailer: ${movie.imdbId}`);
          try {
            // Try to fetch the IMDb page and look for trailer links
            const imdbPageUrl = `https://www.imdb.com/title/${movie.imdbId}/`;
            const response = await fetch(imdbPageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });
            
            if (response.ok) {
              const html = await response.text();
              
              // Look for YouTube trailer links in the IMDb page
              // IMDb often embeds YouTube trailers
              const youtubeMatch = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
              const youtubeEmbedMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
              
              if (youtubeMatch && youtubeMatch[1]) {
                trailerUrl = `https://www.youtube.com/watch?v=${youtubeMatch[1]}`;
                source = 'imdb-youtube';
                console.log(`  ✅ Found YouTube trailer from IMDb: ${trailerUrl}`);
              } else if (youtubeEmbedMatch && youtubeEmbedMatch[1]) {
                trailerUrl = `https://www.youtube.com/watch?v=${youtubeEmbedMatch[1]}`;
                source = 'imdb-youtube';
                console.log(`  ✅ Found YouTube trailer from IMDb: ${trailerUrl}`);
              } else {
                console.log(`  ⚠️ No YouTube trailer found on IMDb page`);
              }
            }
          } catch (error) {
            console.log(`  ⚠️ Error checking IMDb, will use YouTube search:`, error.message);
          }
        }
        
        // If no trailer found from IMDb, use YouTube embed search as fallback
        if (!trailerUrl) {
          console.log(`  Using YouTube embed search`);
          const encodedQuery = encodeURIComponent(searchQuery);
          trailerUrl = `https://www.youtube.com/embed?listType=search&list=${encodedQuery}`;
          source = 'youtube-embed';
        }
        
        console.log(`  ✅ Created trailer URL (${source})`);
        
        if (trailerUrl) {
          // Update the movie
          movie.trailer = trailerUrl;
          await kv.set(`movie:${movie.id}`, movie);
          
          updatedCount++;
          results.push({
            movieId: movie.id,
            title: movie.title,
            status: 'success',
            trailerUrl,
            source
          });
          
          console.log(`✅ Updated ${movie.title} with trailer: ${trailerUrl}`);
        }
        
        // Small delay to be respectful to IMDb/YouTube
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error processing ${movie.title}:`, error);
        errorCount++;
        results.push({
          movieId: movie.id,
          title: movie.title,
          status: 'error',
          error: String(error)
        });
      }
    }
    
    const summary = {
      total: movies.length,
      processed: moviesToUpdate.length,
      updated: updatedCount,
      errors: errorCount,
      skipped: skippedCount,
      remaining: movies.filter(m => !m.trailer || m.trailer.trim() === '').length - moviesToUpdate.length
    };
    
    console.log('Summary:', summary);
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    return c.json({ 
      success: true, 
      summary,
      results
    });
  } catch (error) {
    console.error("Error in batch trailer fetch:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update movie trailer URL
app.patch("/make-server-ea58c774/movies/:id/trailer", async (c) => {
  try {
    const id = c.req.param("id");
    const { trailer } = await c.req.json();
    
    // Get the existing movie
    const movie = await kv.get(`movie:${id}`);
    if (!movie) {
      return c.json({ success: false, error: "Movie not found" }, 404);
    }
    
    // Update the trailer field
    const updatedMovie = { ...movie, trailer };
    await kv.set(`movie:${id}`, updatedMovie);
    
    console.log(`✅ Updated trailer for: ${movie.title}`);
    
    if (c.req.raw.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    return c.json({ success: true, movie: updatedMovie });
  } catch (error) {
    console.error("Error updating movie trailer:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all movies
app.get("/make-server-ea58c774/movies", async (c) => {
  try {
    const movies = await kv.getByPrefix("movie:");
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true, movies });
  } catch (error) {
    console.error("Error fetching movies:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Add a new movie
app.post("/make-server-ea58c774/movies", async (c) => {
  try {
    const movie = await c.req.json();
    await kv.set(`movie:${movie.id}`, movie);
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true, movie });
  } catch (error) {
    console.error("Error adding movie:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete a movie
app.delete("/make-server-ea58c774/movies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`movie:${id}`);
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting movie:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update movie poster
app.patch("/make-server-ea58c774/movies/:id/poster", async (c) => {
  try {
    const id = c.req.param("id");
    const { image } = await c.req.json();
    
    // Get the existing movie
    const movie = await kv.get(`movie:${id}`);
    if (!movie) {
      return c.json({ success: false, error: "Movie not found" }, 404);
    }
    
    // Update the image field
    const updatedMovie = { ...movie, image };
    await kv.set(`movie:${id}`, updatedMovie);
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    return c.json({ success: true, movie: updatedMovie });
  } catch (error) {
    console.error("Error updating movie poster:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update movie fields (genre, etc.)
app.patch("/make-server-ea58c774/movies/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const updates = await c.req.json();
    
    // Get the existing movie
    const movie = await kv.get(`movie:${id}`);
    if (!movie) {
      return c.json({ success: false, error: "Movie not found" }, 404);
    }
    
    // Update the movie with the provided fields
    const updatedMovie = { ...movie, ...updates };
    await kv.set(`movie:${id}`, updatedMovie);
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    return c.json({ success: true, movie: updatedMovie });
  } catch (error) {
    console.error("Error updating movie:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all "to watch" movies
app.get("/make-server-ea58c774/towatch", async (c) => {
  try {
    const toWatchMovies = await kv.getByPrefix("towatch:");
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true, movies: toWatchMovies });
  } catch (error) {
    console.error("Error fetching to watch movies:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Add a new "to watch" movie
app.post("/make-server-ea58c774/towatch", async (c) => {
  try {
    const movie = await c.req.json();
    await kv.set(`towatch:${movie.id}`, movie);
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true, movie });
  } catch (error) {
    console.error("Error adding to watch movie:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete a "to watch" movie
app.delete("/make-server-ea58c774/towatch/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`towatch:${id}`);
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting to watch movie:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get comments for a movie
app.get("/make-server-ea58c774/comments/:movieId", async (c) => {
  try {
    const movieId = c.req.param("movieId");
    const comments = await kv.getByPrefix(`comment:${movieId}:`);
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true, comments });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all comments
app.get("/make-server-ea58c774/comments", async (c) => {
  try {
    const comments = await kv.getByPrefix("comment:");
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true, comments });
  } catch (error) {
    console.error("Error fetching all comments from database:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Add a comment to a movie
app.post("/make-server-ea58c774/comments", async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body || typeof body !== 'object') {
       throw new Error("Invalid request body");
    }
    
    const movieId = body.movieId;
    // Ensure movieId exists
    if (!movieId) {
      throw new Error("movieId is required");
    }
    
    // Use explicit variable for ID to avoid any confusion
    let commentId = body.id;
    if (!commentId) {
      commentId = crypto.randomUUID();
      body.id = commentId;
    }

    // Construct key explicitly
    const key = `comment:${movieId}:${commentId}`;

    await kv.set(key, body);
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true, comment: body });
  } catch (error) {
    console.error("Error adding comment:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete a comment
app.delete("/make-server-ea58c774/comments/:movieId/:commentId", async (c) => {
  try {
    const movieId = c.req.param("movieId");
    const commentId = c.req.param("commentId");
    await kv.del(`comment:${movieId}:${commentId}`);
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Submit a rating for a movie
app.post("/make-server-ea58c774/ratings", async (c) => {
  try {
    const { movieId, rating, userIdentifier } = await c.req.json();
    
    if (!movieId || !rating || !userIdentifier) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    if (rating < 1 || rating > 5) {
      return c.json({ success: false, error: "Rating must be between 1 and 5" }, 400);
    }
    
    const ratingData = {
      movieId,
      rating,
      userIdentifier,
      timestamp: Date.now(),
    };
    
    // Store rating with key: rating:movieId:userIdentifier
    await kv.set(`rating:${movieId}:${userIdentifier}`, ratingData);
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    return c.json({ success: true, rating: ratingData });
  } catch (error) {
    console.error("Error submitting rating:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all ratings for a movie
app.get("/make-server-ea58c774/ratings/:movieId", async (c) => {
  try {
    const movieId = c.req.param("movieId");
    const ratings = await kv.getByPrefix(`rating:${movieId}:`);
    
    // Calculate average
    const average = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0;
    
    if (c.req.raw.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    
    return c.json({ 
      success: true, 
      ratings,
      average: Math.round(average * 10) / 10, // Round to 1 decimal
      count: ratings.length 
    });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get all ratings (for calculating averages on load)
app.get("/make-server-ea58c774/ratings", async (c) => {
  try {
    const allRatings = await kv.getByPrefix("rating:");
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    // Group ratings by movieId
    const ratingsByMovie: { [key: string]: any[] } = {};
    allRatings.forEach(rating => {
      if (!ratingsByMovie[rating.movieId]) {
        ratingsByMovie[rating.movieId] = [];
      }
      ratingsByMovie[rating.movieId].push(rating);
    });
    
    // Calculate averages
    const averages: { [key: string]: { average: number, count: number } } = {};
    Object.keys(ratingsByMovie).forEach(movieId => {
      const ratings = ratingsByMovie[movieId];
      const average = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      averages[movieId] = {
        average: Math.round(average * 10) / 10,
        count: ratings.length
      };
    });
    
    return c.json({ success: true, averages });
  } catch (error) {
    console.error("Error fetching all ratings:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get user's personal ratings
app.get("/make-server-ea58c774/user-ratings/:userIdentifier", async (c) => {
  try {
    const userIdentifier = c.req.param("userIdentifier");
    const allRatings = await kv.getByPrefix("rating:");
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    // Filter ratings for this user
    const userRatings: { [key: string]: number } = {};
    allRatings.forEach(rating => {
      if (rating.userIdentifier === userIdentifier) {
        userRatings[rating.movieId] = rating.rating;
      }
    });
    
    return c.json({ success: true, userRatings });
  } catch (error) {
    console.error("Error fetching user ratings:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create a new user account
app.post("/make-server-ea58c774/auth/signup", async (c) => {
  try {
    const { username, email, password } = await c.req.json();
    
    if (!username || !email || !password) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }
    
    // Check if username already exists
    const existingUserByUsername = await kv.get(`user:username:${username.toLowerCase()}`);
    if (existingUserByUsername) {
      return c.json({ success: false, error: "Username already exists" }, 400);
    }
    
    // Check if email already exists
    const existingUserByEmail = await kv.get(`user:email:${email.toLowerCase()}`);
    if (existingUserByEmail) {
      return c.json({ success: false, error: "Email already registered" }, 400);
    }
    
    // Create user object
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const user = {
      id: userId,
      username,
      email: email.toLowerCase(),
      password, // In production, this should be hashed!
      createdAt: Date.now(),
    };
    
    // Store user by ID, username, and email for easy lookup
    await kv.set(`user:id:${userId}`, user);
    await kv.set(`user:username:${username.toLowerCase()}`, user);
    await kv.set(`user:email:${email.toLowerCase()}`, user);
    
    // If user has disconnected, don't try to send a response
    if (c.req.raw.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return c.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error("Error creating user account:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// User login
app.post("/make-server-ea58c774/auth/login", async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({ success: false, error: "Missing username or password" }, 400);
    }
    
    // Get user by username
    const user = await kv.get(`user:username:${username.toLowerCase()}`);
    
    if (!user) {
      return c.json({ success: false, error: "Invalid username or password" }, 401);
    }
    
    // Check password (in production, use proper password hashing comparison)
    if (user.password !== password) {
      return c.json({ success: false, error: "Invalid username or password" }, 401);
    }
    
    // If user has disconnected, don't try to send a response
    if (c.req.raw.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return c.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error("Error during login:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update user profile
app.patch("/make-server-ea58c774/auth/profile", async (c) => {
  try {
    const { userId, email, password, profilePicture } = await c.req.json();
    
    if (!userId) {
      return c.json({ success: false, error: "User ID is required" }, 400);
    }
    
    // Get existing user
    const user = await kv.get(`user:id:${userId}`);
    
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Prepare updated user object
    const updatedUser = {
      ...user,
    };
    
    // Update email if provided and different
    if (email && email !== user.email) {
      const emailLower = email.toLowerCase();
      
      // Check if new email already exists
      const existingUserByEmail = await kv.get(`user:email:${emailLower}`);
      if (existingUserByEmail && existingUserByEmail.id !== userId) {
        return c.json({ success: false, error: "Email already in use" }, 400);
      }
      
      // Delete old email mapping
      await kv.del(`user:email:${user.email.toLowerCase()}`);
      
      updatedUser.email = emailLower;
      
      // Create new email mapping
      await kv.set(`user:email:${emailLower}`, updatedUser);
    }
    
    // Update password if provided
    if (password && password.trim() !== '') {
      updatedUser.password = password; // In production, hash this!
    }
    
    // Update profile picture if provided
    if (profilePicture !== undefined) {
      updatedUser.profilePicture = profilePicture;
    }
    
    // Update user in all storage locations
    await kv.set(`user:id:${userId}`, updatedUser);
    await kv.set(`user:username:${user.username.toLowerCase()}`, updatedUser);
    
    // If email wasn't changed, still update it
    if (!email || email === user.email) {
      await kv.set(`user:email:${user.email.toLowerCase()}`, updatedUser);
    }
    
    // If user has disconnected, don't try to send a response
    if (c.req.raw.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = updatedUser;
    return c.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error("Error updating profile:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Forgot password - Send password reset email using Supabase Auth
app.post("/make-server-ea58c774/auth/forgot-password", async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ success: false, error: "Email is required" }, 400);
    }
    
    // Check if user exists with this email in our KV store
    const user = await kv.get(`user:email:${email.toLowerCase()}`);
    
    if (!user) {
      return c.json({ success: false, error: "No account found with this email address" }, 404);
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return c.json({ 
        success: false, 
        error: "Server configuration error. Please contact administrator." 
      }, 500);
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Send password reset email using Supabase Auth
    // The email will contain a link to: https://[your-project].supabase.co/auth/v1/verify?token=...&type=recovery
    // We need to configure the redirect URL to point to our reset-password page
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${c.req.header('origin') || 'http://localhost:5173'}/reset-password`,
    });
    
    if (error) {
      console.error('Supabase password reset error:', error);
      return c.json({ 
        success: false, 
        error: "Failed to send reset email. Please try again." 
      }, 500);
    }
    
    console.log(`Password reset email sent to: ${email}`);
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    return c.json({ 
      success: true, 
      message: "If an account exists with this email, you will receive a password reset link shortly." 
    });
  } catch (error) {
    console.error("Error processing forgot password request:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Reset password - Update user password in KV store
app.post("/make-server-ea58c774/auth/reset-password", async (c) => {
  try {
    const { email, newPassword } = await c.req.json();
    
    if (!email || !newPassword) {
      return c.json({ success: false, error: "Email and new password are required" }, 400);
    }
    
    // Get user by email
    const user = await kv.get(`user:email:${email.toLowerCase()}`);
    
    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }
    
    // Update password (in production, this should be hashed!)
    const updatedUser = { ...user, password: newPassword };
    
    // Update all user records
    await kv.set(`user:id:${user.id}`, updatedUser);
    await kv.set(`user:username:${user.username.toLowerCase()}`, updatedUser);
    await kv.set(`user:email:${user.email.toLowerCase()}`, updatedUser);
    
    console.log(`Password reset successful for email: ${email}`);
    
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });

    return c.json({ 
      success: true, 
      message: "Password has been reset successfully" 
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

Deno.serve(
  {
    onError: (error) => {
      // Suppress known connection errors handled by the runtime
      const errorStr = String(error);
      if (
        error?.name === "Http" || 
        errorStr.includes("connection closed") || 
        errorStr.includes("broken pipe") ||
        errorStr.includes("network error")
      ) {
        return new Response(null, { status: 499 });
      }
      console.error("Unhandled server error:", error);
      return new Response("Internal Server Error", { status: 500 });
    },
  },
  async (req) => {
    // Handle client disconnection gracefully
    if (req.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    try {
      return await app.fetch(req);
    } catch (error) {
      // Check for connection errors in the handler catch block
      const errorStr = String(error);
      if (
        error?.name === "Http" || 
        errorStr.includes("connection closed") || 
        errorStr.includes("broken pipe") ||
        errorStr.includes("network error")
      ) {
        return new Response(null, { status: 499 });
      }
      
      console.error("Unhandled request error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
);