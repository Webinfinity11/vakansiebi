'use client';

import { useEffect, useState } from 'react';
import { clearNavTrail, readNavTrail } from '@/lib/vacancy-navigation';

/* A page for one purpose: reading back, from the phone that produced it, what
   the history did. Nothing is sent anywhere — the trail lives in this browser. */
export default function NavigationTrail() {
  const [entries, setEntries] = useState<unknown[]>([]);
  // The trail is read after paint, so the server's empty page hydrates cleanly.
  useEffect(() => {
    const timer = setTimeout(() => setEntries(readNavTrail()), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <main style={{ padding: 16, font: '13px/1.5 ui-monospace, monospace' }}>
      <h1 style={{ font: '600 16px/1.3 system-ui' }}>
        ნავიგაციის ჩანაწერი ({entries.length})
      </h1>
      <p style={{ font: '13px/1.5 system-ui', color: '#555' }}>
        გაიარე გზა — ვაკანსიაში შესვლა და გამოსვლა — სანამ საიტიდან არ
        გამოგაგდებს, დაბრუნდი აქ და გამომიგზავნე ეს სია.
      </p>
      <button
        type="button"
        onClick={() => {
          clearNavTrail();
          setEntries([]);
        }}
        style={{
          padding: '8px 14px',
          marginBottom: 12,
          font: '14px system-ui',
        }}
      >
        გასუფთავება
      </button>
      <pre
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}
      >
        {entries.map((entry) => JSON.stringify(entry)).join('\n')}
      </pre>
    </main>
  );
}
