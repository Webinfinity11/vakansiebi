/* Native sharing on phones, clipboard elsewhere.
   navigator.share opens the system sheet (Messenger, WhatsApp, Telegram, SMS) on iOS and
   Android; a desktop browser without it, or a user who dismisses the sheet, falls back to
   copying the link. The result tells the caller which of the two happened so its feedback
   message can be accurate. */
export type ShareOutcome = 'shared' | 'copied' | 'failed';
export async function shareLink(
  url: string,
  title: string,
  text?: string,
): Promise<ShareOutcome> {
  const data: ShareData = { url, title, ...(text ? { text } : {}) };
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare(data))
  ) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      // The person closed the share sheet; nothing was sent and nothing needs copying.
      if (error instanceof Error && error.name === 'AbortError')
        return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
