import { siteUrl } from '../seo';
import { publicBlogPosts } from './blog';
import { salaryPages } from './salary-pages';
export async function contentEntries() {
  const [posts, roles] = await Promise.all([publicBlogPosts(), salaryPages()]);
  return [
    ...posts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt ?? post.publishedAt),
    })),
    ...roles
      .filter((role) => role.month || role.day)
      .map((role) => ({ url: `${siteUrl}/salaries/${role.slug}` })),
  ];
}
