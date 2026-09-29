/** Executes trusted administrator code once per document, never in the editor. */
export async function mountCustomCode(
  html: string,
  canRun: () => boolean = () => true,
) {
  const runtime = window as Window & { jobxCustomCodeStarted?: boolean };
  if (!canRun() || !html.trim() || runtime.jobxCustomCodeStarted) return;
  runtime.jobxCustomCodeStarted = true;
  const template = document.createElement('template');
  template.innerHTML = html;
  // JavaScript is running: a noscript pixel must not send a second PageView.
  template.content
    .querySelectorAll('noscript')
    .forEach((node) => node.remove());
  const scripts = [...template.content.querySelectorAll('script')].map(
    (node) => {
      const marker = document.createComment('custom script');
      node.replaceWith(marker);
      return { node, marker };
    },
  );
  const container = document.createElement('div');
  container.hidden = true;
  container.dataset.jobxCustomCode = 'true';
  container.append(template.content);
  document.body.append(container);
  for (const { node, marker } of scripts) {
    if (!canRun()) return;
    const script = document.createElement('script');
    for (const attribute of node.attributes)
      script.setAttribute(attribute.name, attribute.value);
    script.textContent = node.textContent;
    // Preserve ordering for snippets with an external library followed by setup.
    const wait = script.src && !script.hasAttribute('async');
    if (wait) {
      script.async = false;
      await new Promise<void>((resolve) => {
        script.onload = () => resolve();
        script.onerror = () => resolve();
        marker.replaceWith(script);
      });
    } else marker.replaceWith(script);
  }
}
