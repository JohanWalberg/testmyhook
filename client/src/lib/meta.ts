import { useEffect } from 'react';

const DEFAULT_TITLE = 'TestMyHook \u2014 see what a webhook sends';

/** Sets the document title (and optionally the meta description) for a page. */
export function usePageMeta(title?: string, description?: string): void {
  useEffect(() => {
    document.title = title ? `${title} \u2014 TestMyHook` : DEFAULT_TITLE;
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    }
  }, [title, description]);
}
