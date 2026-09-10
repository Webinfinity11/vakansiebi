export default function Loading() {
  return (
    <main className="vacancy-unavailable" aria-busy="true">
      <output>ვაკანსია იტვირთება…</output>
      <div className="job-skeleton" aria-hidden="true">
        <span />
        <div>
          <i />
          <i />
          <i />
        </div>
      </div>
    </main>
  );
}
