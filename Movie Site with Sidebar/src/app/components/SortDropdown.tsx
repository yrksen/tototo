import { ArrowUpDown, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export type SortOption = 'dateAdded' | 'dateAddedLatest' | 'title' | 'year' | 'imdbRating' | 'userRating' | 'communityRating';

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'dateAdded', label: 'Date Added (Newest)' },
    { value: 'dateAddedLatest', label: 'Date Added (Latest)' },
    { value: 'title', label: 'Title (A-Z)' },
    { value: 'year', label: 'Year' },
    { value: 'imdbRating', label: 'IMDb Rating' },
    { value: 'communityRating', label: 'Community Rating' },
    { value: 'userRating', label: 'Your Rating' },
  ];

  const currentLabel = sortOptions.find(opt => opt.value === value)?.label || 'Sort by';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 h-10 bg-white dark:bg-black border-2 border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-medium dark:text-white"
      >
        <ArrowUpDown className="size-4" />
        <span className="hidden md:inline">{currentLabel}</span>
        <span className="md:hidden">Sort</span>
        <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-black border-2 border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                value === option.value ? 'bg-blue-50 dark:bg-blue-600 text-blue-600 dark:text-white font-medium' : 'dark:text-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}