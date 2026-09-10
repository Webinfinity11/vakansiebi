import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="vacancy-unavailable">
      <h1>ვაკანსია აღარ არის ხელმისაწვდომი</h1>
      <p>შესაძლოა ვადა ამოიწურა ან განცხადება მოიხსნა.</p>
      <Link className="primary" href="/">
        სხვა ვაკანსიების ნახვა
      </Link>
    </main>
  );
}
