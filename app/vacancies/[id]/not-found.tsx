import { UiText } from '@/app/ui-language';
import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="vacancy-unavailable">
      <title>
        <UiText>{'ვაკანსია აღარ არის ხელმისაწვდომი | JOBX'}</UiText>
      </title>
      <h1>
        <UiText>{'ვაკანსია აღარ არის ხელმისაწვდომი'}</UiText>
      </h1>
      <p>
        <UiText>{'შესაძლოა, ვადა ამოიწურა ან განცხადება მოიხსნა.'}</UiText>
      </p>
      <Link className="primary" href="/">
        <UiText>{'სხვა ვაკანსიების ნახვა'}</UiText>
      </Link>
    </main>
  );
}
