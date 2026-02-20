import { X, Shuffle } from "lucide-react";
import { Button } from "./ui/button";

interface TiredOfScrollingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRandomMovie: () => void;
  isDarkMode: boolean;
}

export function TiredOfScrollingModal({ 
  isOpen, 
  onClose, 
  onRandomMovie,
  isDarkMode 
}: TiredOfScrollingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div 
        className={`relative max-w-md w-full rounded-lg p-6 shadow-xl ${
          isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 transition-opacity hover:opacity-70 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {/* Content */}
        <div className="text-center space-y-4">
          <div className="text-4xl mb-2">😴</div>
          <h2 className="text-2xl font-bold">Tired of scrolling?</h2>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Let us pick a random movie for you!
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Keep Scrolling
            </Button>
            <Button
              onClick={() => {
                onRandomMovie();
                onClose();
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Shuffle className="size-4 mr-2" />
              Surprise Me!
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
