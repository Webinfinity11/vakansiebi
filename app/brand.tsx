import Image from 'next/image';
import Link from 'next/link';
export function Brand() {
  return (
    <Link
      className="brand jobx-brand"
      href="/"
      aria-label="JOBX — მთავარი გვერდი"
    >
      <Image
        src="/brand/jobx.png"
        alt="JOBX"
        width={180}
        height={60}
        sizes="(max-width: 360px) 132px, (max-width: 760px) 144px, 180px"
      />
    </Link>
  );
}
