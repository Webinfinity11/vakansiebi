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
  createEditorialArticle,
  staticEditorialArticles,
} from '@/lib/server/blog-editorial';
export const dynamic = 'force-dynamic';
function configured() {
  if (process.env.BLOG_STORAGE_ENABLED !== 'true')
    throw new ApiError(
      'ბლოგის შენახვა ჯერ არ არის გააქტიურებული. მიმართე საიტის ადმინისტრატორს.',
      503,
    );
}
export async function GET() {
  try {
    await requireAdmin();
    const storageEnabled = process.env.BLOG_STORAGE_ENABLED === 'true';
    return Response.json(
      {
        articles: storageEnabled
          ? await editorialArticles()
          : staticEditorialArticles(),
        storageEnabled,
      },
      {
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
const change = z.union([
  z.object({ action: z.literal('create'), content: z.unknown() }),
  z.object({
    id: z.union([z.uuid(), z.string().regex(/^static:[a-z][a-z0-9-]*$/)]),
    revision: z.number().int().nonnegative(),
    action: z.enum(['save', 'publish', 'unpublish', 'reject']),
    content: z.unknown().optional(),
    reviewed: z.boolean().optional(),
  }),
]);
export async function POST(req: Request) {
  try {
    await requireAdmin();
    checkOrigin(req);
    configured();
    const input = change.parse(await readBody(req));
    if (input.action === 'create')
      return Response.json(await createEditorialArticle(input.content), {
        status: 201,
        headers: { 'Cache-Control': 'private, no-store' },
      });
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
