import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Movie } from "./MovieCard";

interface AddMovieDialogProps {
  onAddMovie: (movie: Movie) => void;
  existingMovies: Movie[];
  currentViewMovies?: Movie[]; // Movies from the current view only for duplicate checking
}

// Fetch movie data from OMDb
const fetchMovieFromIMDb = async (imdbUrl: string): Promise<Partial<Movie> | null> => {
  const imdbIdMatch = imdbUrl.match(/tt\d{7,8}/);
  if (!imdbIdMatch) return null;

  const imdbId = imdbIdMatch[0];

  try {
    const apiKey = "f9062e1"; // Your OMDb API key
    // Add plot=full parameter to get full plot instead of short version
    const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&plot=full&apikey=${apiKey}`);
    const data = await res.json();

    if (data.Response === "False") return null;

    // Determine runtime value based on type (series vs movie)
    let runtimeValue = undefined;
    if (data.Type === "series") {
      // For series, use season count
      if (data.totalSeasons && data.totalSeasons !== "N/A") {
        runtimeValue = `${data.totalSeasons} Season${data.totalSeasons !== "1" ? "s" : ""}`;
      }
    } else {
      // For movies, use runtime
      if (data.Runtime && data.Runtime !== "N/A") {
        runtimeValue = data.Runtime;
      }
    }

    return {
      title: data.Title,
      year: parseInt(data.Year),
      genre: data.Genre, // Get all genres, not just the first one
      rating: parseFloat(data.imdbRating) || 0,
      description: data.Plot,
      poster: data.Poster && data.Poster !== "N/A" ? data.Poster : undefined,
      runtime: runtimeValue,
      imdbId: imdbId,
      imdbRating: parseFloat(data.imdbRating) || 0,
      director: data.Director && data.Director !== "N/A" ? data.Director : undefined,
      cast: data.Actors && data.Actors !== "N/A" ? data.Actors.split(", ") : undefined,
      plot: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined, // This now contains the full plot
    };
  } catch (err) {
    console.error("Error fetching movie:", err);
    return null;
  }
};

export function AddMovieDialog({ onAddMovie, existingMovies, currentViewMovies }: AddMovieDialogProps) {
  const [open, setOpen] = useState(false);
  const [imdbUrl, setImdbUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const movieData = await fetchMovieFromIMDb(imdbUrl.trim());

      if (!movieData) {
        setError("Invalid IMDb URL or movie not found.");
        setLoading(false);
        return;
      }

      // Check if movie already exists by title
      const duplicateMovie = currentViewMovies
        ? currentViewMovies.find(
            (movie) => movie.title.toLowerCase() === movieData.title?.toLowerCase()
          )
        : existingMovies.find(
            (movie) => movie.title.toLowerCase() === movieData.title?.toLowerCase()
          );

      if (duplicateMovie) {
        setError(`This movie already exists in your collection (ID: #${duplicateMovie.id}).`);
        setLoading(false);
        return;
      }

      const newId = existingMovies.length > 0
        ? Math.max(...existingMovies.map((m) => m.id)) + 1
        : 1;

      // Fallback images if OMDb poster is missing
      const genreImageMap: Record<string, string> = {
        Action: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Comedy: "https://images.unsplash.com/photo-1587042285747-583b4d4d73b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Drama: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Horror: "https://images.unsplash.com/photo-1767048264833-5b65aacd1039?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Romance: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Thriller: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "Sci-Fi": "https://images.unsplash.com/photo-1759267960211-5f445be05c93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        Animation: "https://images.unsplash.com/photo-1759267960211-5f445be05c93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
      };

      const newMovie: Movie = {
        id: newId,
        title: movieData.title || "Unknown Title",
        year: movieData.year || 2024,
        genre: movieData.genre || "Drama",
        rating: movieData.rating || 7.0,
        image: movieData.poster || genreImageMap[movieData.genre || "Drama"] || genreImageMap.Action,
        description: movieData.description || "No description available.",
        runtime: movieData.runtime,
        imdbId: movieData.imdbId,
        imdbRating: movieData.imdbRating,
        director: movieData.director,
        cast: movieData.cast,
        plot: movieData.plot,
        dateAdded: Date.now(), // Add timestamp for recently added tracking
      };

      onAddMovie(newMovie);
      setOpen(false);
      setImdbUrl("");
    } catch (err) {
      setError("Failed to fetch movie data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="flex items-center gap-2 text-sm font-medium border-2 bg-black dark:bg-white text-white dark:text-black border-black dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200">
          <Plus className="size-4" />
          Add Movie
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-background dark:bg-gray-800">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Add Movie from IMDb</DialogTitle>
          <DialogDescription className="dark:text-gray-300">
            Paste an IMDb link to add a movie to your collection.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="imdb-url" className="dark:text-gray-200">IMDb URL</Label>
            <Input
              id="imdb-url"
              placeholder="https://www.imdb.com/title/tt1234567/"
              value={imdbUrl}
              onChange={(e) => setImdbUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) handleSubmit();
              }}
              className="dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:placeholder-gray-400"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              setImdbUrl("");
              setError("");
            }}
            className="dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading || !imdbUrl.trim()}>
            {loading ? "Adding..." : "Add Movie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}