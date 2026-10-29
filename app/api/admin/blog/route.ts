import { z } from 'zod';
import {
  apiError,
  checkOrigin,
  readBody,
  requireAdmin,
  ApiError,
} from '@/lib/server/auth';
import {
  editorialArticles,
  updateEditorialArticle,
} from '@/lib/server/blog-editorial';
export const dynamic = 'force-dynamic';
function configured() {
  if (process.env.BLOG_STORAGE_ENABLED !== 'true')
    throw new ApiError(
      'ბლოგის საცავი ჯერ არ არის ჩართული. საჭიროა მიგრაცია 066 და BLOG_STORAGE_ENABLED=true.',
      503,
    );
}
export async function GET() {
  try {
    await requireAdmin();
    configured();
    return Response.json(await editorialArticles(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
const change = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  action: z.enum(['save', 'publish', 'unpublish', 'reject']),
  content: z.unknown().optional(),
  reviewed: z.boolean().optional(),
});
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    configured();
    const input = change.parse(await readBody(req));
    if (input.action === 'publish' && !input.reviewed)
      throw new ApiError('გამოქვეყნებამდე გადაამოწმე ტექსტი და წყაროები.');
    const article = await updateEditorialArticle(
      input.id,
      input.revision,
      input.action,
      input.content,
    );
    return Response.json(article, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
