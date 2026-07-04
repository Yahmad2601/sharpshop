import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search products..." }: SearchBarProps) {
  return (
    <div className="relative flex items-center w-full">
      <Search className="absolute left-3 w-4 h-4 text-white/50 pointer-events-none" />
      <Input
        data-testid="input-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search products"
        className="pl-10 pr-10 h-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30"
      />
      {value && (
        <Button
          data-testid="button-clear-search"
          size="icon"
          variant="ghost"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1 h-8 w-8 text-white/50"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
