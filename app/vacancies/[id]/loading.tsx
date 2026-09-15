import { PublicHeader } from '../../public-header';

/* The masthead and the page frame need no data, so they appear at once; only the vacancy
   itself waits, drawn in the shape it will take so nothing moves when it arrives. */
export default function Loading() {
  return (
    <div className="board-shell vacancy-page has-personal-progress has-contact">
      <PublicHeader />
      <main className="vacancy-page-main" aria-busy="true">
        <output className="sr-only">ვაკანსია იტვირთება…</output>
        <div
          className="vacancy-breadcrumb vacancy-skeleton-line"
          aria-hidden="true"
        >
          <i />
        </div>
        <div className="vacancy-layout vacancy-skeleton" aria-hidden="true">
          <section className="vacancy-overview">
            <div className="vacancy-skeleton-company">
              <span />
              <i />
            </div>
            <i className="vacancy-skeleton-title" />
            <i className="vacancy-skeleton-meta" />
            <div className="vacancy-skeleton-facts">
              <i />
              <i />
              <i />
              <i />
            </div>
          </section>
          <aside className="vacancy-contact">
            <div className="vacancy-skeleton-panel">
              <i />
              <i className="vacancy-skeleton-button" />
              <i />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
