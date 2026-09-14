/** Two-tone occupational marks. Decorative; the category is written alongside. */
const marks: Record<string, string> = {
  ტექნოლოგიები: 'M10 12h20v14H10z M7 30h26 M17 17l-3 3 3 3 M23 17l3 3-3 3',
  გაყიდვები: 'M10 16h20l-2 17H12z M15 16v-4a5 5 0 0 1 10 0v4',
  მარკეტინგი: 'M9 18l20-7v20L9 24z M13 26l2 7h5l-3-6',
  ადმინისტრაცია: 'M8 16h24v16H8z M15 16v-5h10v5 M8 23h24 M18 22v4h4v-4',
  ფინანსები: 'M9 14h22v19H9z M9 14l18-5v5 M24 21h9v7h-9z',
  ლოჯისტიკა:
    'M7 13h17v17H7z M24 19h6l4 6v5H24 M10 30a3 3 0 1 0 6 0 M26 30a3 3 0 1 0 6 0',
  მომსახურება:
    'M10 22v-3a10 10 0 0 1 20 0v3 M8 20h5v9H8z M27 20h5v9h-5z M29 29v3h-8',
  სამედიცინო: 'M9 14h22v19H9z M15 14v-4h10v4 M20 19v9 M16 23h8',
  განათლება: 'M6 17l14-7 14 7-14 7z M12 21v8q8 6 16 0v-8 M34 17v12',
  მშენებლობა:
    'M8 26h24 M10 26v-5a10 10 0 0 1 20 0v5 M17 20V9h6v11 M7 27v5h26v-5',
  დაცვა: 'M20 8l12 5v9q0 8-12 13Q8 30 8 22v-9z M14 21l4 4 8-9',
  წარმოება: 'M8 32V16l9 6v-6l9 6V9h6v23z M12 27h3 M20 27h3 M28 27h2',
  იურიდიული: 'M20 9v23 M12 33h16 M10 15h20 M10 15l-5 10h10z M30 15l-5 10h10z',
  სილამაზე: 'M20 8l3 9 9 3-9 3-3 9-3-9-9-3 9-3z M31 8v6 M28 11h6',
};
export function CategoryMark({ category = '' }: { category?: string }) {
  return (
    <svg
      className="category-mark"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="mark-wash"
        d="M7 7h20l8 8v18H7z"
        fill="currentColor"
        opacity=".12"
      />
      <path
        d={marks[category] || marks.ადმინისტრაცია}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M29 5h6v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".55"
      />
    </svg>
  );
}
