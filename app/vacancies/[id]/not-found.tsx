import { siteName } from "@/lib/site-brand";
import { UiText } from "@/app/ui-language";
import Link from "next/link";
export default function NotFound() {
  return (
    <main className="vacancy-unavailable">
      {/* A title must be plain text; a component inside it printed [object Object]. */}
      <title>{`ვაკანსია აღარ არის ხელმისაწვდომი | ${siteName}`}</title>
      <h1>
        <UiText>{"ვაკანსია აღარ არის ხელმისაწვდომი"}</UiText>
      </h1>
      <p>
        <UiText>{"შესაძლოა, ვადა ამოიწურა ან განცხადება მოიხსნა."}</UiText>
      </p>
      <Link className="primary" href="/">
        <UiText>{"სხვა ვაკანსიების ნახვა"}</UiText>
      </Link>
    </main>
  );
}
