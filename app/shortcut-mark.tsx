import Image from 'next/image';
export function ShortcutMark({
  kind,
}: {
  kind: 'daily' | 'remote' | 'entry' | 'salary';
}) {
  return (
    <span
      className="category-mark shortcut-mark shortcut-3d"
      data-kind={kind}
      aria-hidden="true"
    >
      <Image
        src="/images/jobx-shortcuts-3d-v1.png"
        alt=""
        width={1280}
        height={1280}
        sizes="128px"
      />
    </span>
  );
}
