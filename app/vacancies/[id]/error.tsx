'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="vacancy-unavailable">
      <h1>ვაკანსია ვერ ჩაიტვირთა</h1>
      <p>გთხოვ, სცადე ხელახლა.</p>
      <button className="primary" onClick={reset}>
        ხელახლა ცდა
      </button>
      <Link href="/">ვაკანსიებზე დაბრუნება</Link>
    </main>
  );
}
