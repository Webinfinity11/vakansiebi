import Link from 'next/link';
import { PublicHeader } from './public-header';
import { TrackOnce } from './track-once';
export default function NotFound() {
  return (
    <div className="board-shell vacancy-page">
      <PublicHeader />
      <TrackOnce code="not_found" />
      <main className="vacancy-page-main empty">
        <h1>გვერდი აღარ არის ხელმისაწვდომი</h1>
        <p>შესაძლოა განცხადების ვადა გავიდა ან ბმული შეიცვალა.</p>
        <Link className="primary" href="/">
          აქტიური ვაკანსიების ნახვა
        </Link>
      </main>
    </div>
  );
}
