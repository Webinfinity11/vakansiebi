import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="vacancy-unavailable">
      <h1>დამსაქმებლის გვერდი ვერ მოიძებნა</h1>
      <p>ამ დამსაქმებელს ახლა საკმარისი აქტიური ვაკანსია არ აქვს.</p>
      <Link className="primary" href="/">
        ყველა ვაკანსიის ნახვა
      </Link>
    </main>
  );
}
