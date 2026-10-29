# Satellite View (Zoom Earth) — embedding notes

The **Satellite View** tab (`/satellite-view`, also linked from the dashboard and the top menu) points users to
Zoom Earth's official website, <https://zoom.earth/>, an independent external service.

## Status: permission remains unconfirmed

| Check | Result |
|-------|--------|
| Zoom Earth terms of service (<https://zoom.earth/legal/terms/>) | Allow personal, non-commercial viewing. Forbid scraping, bulk downloading, and mirroring or proxying their materials on other servers. **They don't mention framing/embedding either way.** |
| Security headers (`X-Frame-Options`, CSP `frame-ancestors`) | **Not verified.** The development environment couldn't reach zoom.earth. On the server, the app checks these headers automatically (one `HEAD` request, cached for an hour). |
| Iframe load test in a browser | Not run, for the same reason. Run the steps below on the deployed site. |

Because permission is unclear, embedding is **disabled by default**. The tab shows a fallback panel with an
**Open Zoom Earth** button (opens in a new tab with `rel="noopener noreferrer"`).

## How it behaves

1. `ZOOM_EARTH_EMBED` is not `"true"` → the fallback panel ("Embedding is turned off").
2. `ZOOM_EARTH_EMBED="true"` and Zoom Earth's headers block framing → the fallback panel, with the exact header reason.
3. `ZOOM_EARTH_EMBED="true"` and nothing blocks it → a responsive iframe of `https://zoom.earth/`, with a loading
   indicator and a note to use **Open Zoom Earth** if the frame stays blank.

Nothing is scraped, downloaded, proxied or rehosted, and no headers are altered. The browser enforces Zoom Earth's
own framing rules. A working frame doesn't by itself mean embedding is authorised.

## Testing on the deployed site

1. Ask Zoom Earth for permission first (support@zoom.earth, or their contact page), explaining it's a short-lived
   college demo.
2. If they agree, set `ZOOM_EARTH_EMBED="true"` in `.env`, then run `npm run build && pm2 restart skycast-web`.
3. Open `/satellite-view` on a desktop and on a phone (or in DevTools device mode).
4. Open DevTools → **Console**. An error like *"Refused to display 'https://zoom.earth/' in a frame because it set
   'X-Frame-Options'…"* or *"…violates the Content Security Policy directive: frame-ancestors…"* means
   **embedding is blocked**. Leave the flag off; the fallback link is the correct behaviour.
5. If Zoom Earth renders and works inside the frame with no such errors, **embedding works technically**.
   Record whether Zoom Earth gave permission alongside that result.
