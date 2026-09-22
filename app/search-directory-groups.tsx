import { landingLinks } from '@/lib/seo-landing';
import { Suspense } from 'react';
import { DirectoryLinks, useSearchDirectory } from './search-directory-context';

export function SearchDirectoryGroups() {
  return (
    <Suspense fallback={null}>
      <DirectoryGroups />
    </Suspense>
  );
}

function DirectoryGroups() {
  const links = landingLinks(useSearchDirectory());
  const groups = [
    { title: 'სფერო', key: 'category' },
    { title: 'ქალაქი', key: 'city' },
    { title: 'სამუშაო პირობები', key: 'conditions' },
    { title: 'პროფესია', key: 'q' },
  ].map((group) => ({
    ...group,
    links: links.filter(({ path }) => {
      const params = new URLSearchParams(path.split('?')[1]);
      return group.key === 'conditions'
        ? !['category', 'city', 'q'].some((key) => params.has(key))
        : params.has(group.key);
    }),
  }));

  return (
    <div className="search-directory-browse">
      <h2>მოძებნე ვაკანსია</h2>
      <div className="search-directory-groups">
        {groups
          .filter((group) => group.links.length > 0)
          .map(({ title, key, links: groupLinks }) => (
            <section key={key} className="search-directory-group">
              <h3>{title}</h3>
              <DirectoryLinks links={groupLinks} />
            </section>
          ))}
      </div>
    </div>
  );
}
