export function HeroHeading({
  text,
  shell = false,
}: {
  text: string;
  shell?: boolean;
}) {
  if (shell) return <div className="hero-title hero-heading">{text}</div>;
  return (
    <h1 id="search-heading" className="hero-heading">
      {text}
    </h1>
  );
}
