import { tintOf } from '@/lib/recipeCategories';

interface CategoryChipProps {
  name: string;
  color: string;
  /** Slightly larger, for the filter bar. */
  size?: 'sm' | 'md';
  className?: string;
}

/** The label of one category: its own colour, quiet enough to sit next to a title. */
const CategoryChip = ({ name, color, size = 'sm', className = '' }: CategoryChipProps) => (
  <span
    className={`inline-flex items-center rounded-full font-display font-bold tracking-[-0.01em] ${
      size === 'sm' ? 'px-2 py-0.5 text-[0.6875rem]' : 'px-3 py-1 text-xs'
    } ${tintOf(color)} ${className}`}
  >
    {name}
  </span>
);

export default CategoryChip;
