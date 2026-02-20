import { Star, Trash2 } from "lucide-react";
import { Card } from "./ui/card";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { createSlug } from "../utils/slugify";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export interface Movie {
  id: number;
  title: string;
  year: number;
  genre: string;
  rating: number;
  image: string;
  description: string;
  // Enhanced details
  imdbRating?: number;
  director?: string;
  cast?: string[];
  runtime?: string;
  plot?: string;
  imdbId?: string;
  trailer?: string;
  // User features
  userRating?: number;
  tags?: string[];
  // Community rating
  communityRating?: number;
  ratingCount?: number;
  // Timestamp for recently added tracking
  dateAdded?: number;
}

interface MovieCardProps {
  movie: Movie;
  onClick?: () => void;
  onDelete?: (id: number) => void;
}

export function MovieCard({ movie, onClick, onDelete }: MovieCardProps) {
  const navigate = useNavigate();
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleCardClick = () => {
    navigate(`/movie/${createSlug(movie.title)}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when deleting
    setShowPasswordPrompt(true);
    setPassword("");
    setPasswordError("");
  };

  const handlePasswordSubmit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (password === "hassle") {
      setShowPasswordPrompt(false);
      setPassword("");
      setPasswordError("");
      if (onDelete && confirm(`Are you sure you want to delete "${movie.title}"?`)) {
        onDelete(movie.id);
      }
    } else {
      setPasswordError("Incorrect password");
    }
  };

  const handleCancelPassword = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPasswordPrompt(false);
    setPassword("");
    setPasswordError("");
  };

  return (
    <div 
      className="flex flex-col rounded-xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer relative group border border-gray-200/50 dark:border-gray-700 bg-[#D3D3D3] dark:bg-gray-800 hover:scale-105 hover:-translate-y-2"
      onClick={handleCardClick}
    >
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
        aria-label="Delete movie"
      >
        <Trash2 className="size-4" />
      </button>
      
      {/* Poster - showing top 80% of the image, cropped at bottom */}
      <div className="relative w-full aspect-[2/3] overflow-hidden bg-black">
        <img
          src={movie.image}
          alt={movie.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      
      {/* Text content below the poster */}
      <div className="p-1.5 md:p-3 flex flex-col gap-1 md:gap-1.5">
        <div>
          <h3 className="font-medium text-sm leading-tight line-clamp-1 text-gray-900 dark:text-white">{movie.title}</h3>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-normal">
            <span>{movie.year}</span>
            <span>•</span>
            <span className="line-clamp-1">{movie.genre}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Star className="size-3 fill-yellow-400 text-yellow-400" />
            <span className="text-[11px] font-medium text-gray-900 dark:text-white">{movie.rating.toFixed(1)}</span>
            {movie.runtime && (
              <>
                <span className="text-gray-400 text-[11px]">•</span>
                <span className="text-[11px] text-gray-600 dark:text-gray-400">{movie.runtime}</span>
              </>
            )}
          </div>
          {movie.userRating && movie.userRating > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">★ {movie.userRating}</span>
            </div>
          )}
        </div>
      </div>
      
      {showPasswordPrompt && (
        <Dialog open={showPasswordPrompt} onOpenChange={setShowPasswordPrompt}>
          <DialogContent className="p-4 md:p-6">
            <DialogHeader>
              <DialogTitle>Enter Password</DialogTitle>
              <DialogDescription>
                Please enter the password to delete the movie.
              </DialogDescription>
            </DialogHeader>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="mb-4"
            />
            {passwordError && <p className="text-red-500 mb-4">{passwordError}</p>}
            <div className="flex justify-end">
              <Button
                onClick={handlePasswordSubmit}
                className="mr-2"
              >
                Delete
              </Button>
              <Button
                onClick={handleCancelPassword}
                className="bg-gray-500 hover:bg-gray-600"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}