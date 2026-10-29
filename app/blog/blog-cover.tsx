import Image from 'next/image';
import type { BlogPost } from '@/lib/blog';

/** Covers are pre-compressed WebP files; serving them needs no image transforms. */
export function BlogCover({
  cover,
  decorative = false,
  eager = false,
}: {
  cover: BlogPost['cover'];
  decorative?: boolean;
  eager?: boolean;
}) {
  if (!cover) return null;
  return (
    <Image
      className="blog-cover-image"
      src={cover.src}
      width={cover.width}
      height={cover.height}
      alt={decorative ? '' : cover.alt}
      loading={eager ? 'eager' : 'lazy'}
      unoptimized
    />
  );
}
