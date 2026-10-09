// Faz o <video> conseguir streaming do Drive: intercepta /drive-stream/ID e
// repassa pro Drive com o token no cabeçalho, respeitando o Range (seek).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (!u.pathname.includes('/drive-stream/')) return;
  e.respondWith(stream(e.request, u));
});

async function stream(req, u) {
  const id = u.pathname.split('/').pop();
  const h = { Authorization: 'Bearer ' + u.searchParams.get('t') };
  const range = req.headers.get('Range');
  if (range) h.Range = range;
  let r;
  try {
    r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: h });
  } catch (err) {
    return new Response('falha de rede', { status: 502 });
  }
  if (!r.ok) return new Response('erro ' + r.status, { status: r.status });

  const headers = new Headers({
    'Content-Type': r.headers.get('Content-Type') || 'video/mp4',
    'Accept-Ranges': 'bytes'
  });
  const len = r.headers.get('Content-Length');
  if (len) headers.set('Content-Length', len);

  if (r.status === 206) {
    let cr = r.headers.get('Content-Range');
    const total = +u.searchParams.get('size') || 0;
    const m = range && range.match(/bytes=(\d+)/);
    if (!cr && m && total && len) cr = `bytes ${+m[1]}-${+m[1] + +len - 1}/${total}`;
    if (cr) headers.set('Content-Range', cr);
  }
  return new Response(r.body, { status: r.status, headers });
}
