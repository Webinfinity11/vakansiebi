import {
  Calculator,
  ClipboardList,
  Ellipsis,
  Factory,
  GraduationCap,
  HandPlatter,
  Handshake,
  HardHat,
  Laptop,
  LayoutGrid,
  Megaphone,
  Scale,
  Scissors,
  ShieldCheck,
  Stethoscope,
  Truck,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';
import type { categories } from '@/lib/types';

// Search filters and salary categories use the same visual vocabulary.
const categoryIcons = {
  ტექნოლოგიები: Laptop,
  გაყიდვები: Handshake,
  მარკეტინგი: Megaphone,
  ადმინისტრაცია: ClipboardList,
  ფინანსები: Calculator,
  ლოჯისტიკა: Truck,
  მომსახურება: HandPlatter,
  სამედიცინო: Stethoscope,
  განათლება: GraduationCap,
  მშენებლობა: HardHat,
  დაცვა: ShieldCheck,
  წარმოება: Factory,
  იურიდიული: Scale,
  სილამაზე: Scissors,
  სხვა: Ellipsis,
} satisfies Record<(typeof categories)[number], LucideIcon>;

export function CategoryIcon({
  category,
  ...props
}: LucideProps & { category: string }) {
  const Icon =
    !category || category === 'ყველა'
      ? LayoutGrid
      : (categoryIcons[category as keyof typeof categoryIcons] ?? Ellipsis);
  return <Icon aria-hidden="true" focusable="false" {...props} />;
}
