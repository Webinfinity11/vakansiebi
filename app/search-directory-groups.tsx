import Link from 'next/link';
import { landingLinks } from '@/lib/seo-landing';

const links = landingLinks();
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

export function SearchDirectoryGroups() {
  return (
    <div className="search-directory-browse">
      <h2>მოძებნე ვაკანსია</h2>
      <div className="search-directory-groups">
        {groups.map(({ title, key, links: groupLinks }) => (
          <section key={key} className="search-directory-group">
            <h3>{title}</h3>
            <ul>
              {groupLinks.map(({ path, label }) => (
                <li key={path}>
                  <Link href={path} prefetch={false}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
