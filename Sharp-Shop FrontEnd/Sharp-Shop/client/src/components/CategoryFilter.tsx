import { PRODUCT_CATEGORIES, type ProductCategory } from "@shared/schema";

interface CategoryFilterProps {
  selected: ProductCategory | null;
  onSelect: (category: ProductCategory | null) => void;
}

// Real <button>s (not clickable Badges/divs) so the filters are focusable,
// keyboard-activatable, and announce their pressed state to screen readers.
function FilterChip({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full border text-xs font-semibold whitespace-nowrap px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
        active
          ? "bg-white text-black border-transparent"
          : "bg-white/10 text-white border-white/20 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <div
      role="group"
      aria-label="Filter by category"
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
    >
      <FilterChip
        testId="filter-category-all"
        active={selected === null}
        onClick={() => onSelect(null)}
      >
        All
      </FilterChip>
      {PRODUCT_CATEGORIES.map((category) => (
        <FilterChip
          key={category}
          testId={`filter-category-${category.toLowerCase().replace(/\s+/g, "-")}`}
          active={selected === category}
          onClick={() => onSelect(category)}
        >
          {category}
        </FilterChip>
      ))}
    </div>
  );
}
