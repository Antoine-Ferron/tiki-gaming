// Supabase expose PostgREST sous /rest/v1, le conteneur `rest` de quality/docker-compose.yml à la racine.
// Ce petit proxy retire le préfixe, pour brancher le backend Java et le front sur la base locale jetable.
//   node quality/rest-proxy.mjs            → écoute sur 54331, transmet à 54330
import http from 'node:http'

const LISTEN_PORT = Number(process.env.PROXY_PORT || 54331)
const TARGET_PORT = Number(process.env.REST_PORT || 54330)
const PREFIX = '/rest/v1'

http
  .createServer((req, res) => {
    const path = req.url.startsWith(PREFIX) ? req.url.slice(PREFIX.length) || '/' : req.url
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: TARGET_PORT,
        method: req.method,
        path,
        headers: req.headers,
      },
      (answer) => {
        res.writeHead(answer.statusCode, answer.headers)
        answer.pipe(res)
      },
    )
    upstream.on('error', () => {
      res.writeHead(502)
      res.end()
    })
    req.pipe(upstream)
  })
  .listen(LISTEN_PORT, () => console.log(`Proxy PostgREST prêt sur http://localhost:${LISTEN_PORT}${PREFIX}`))
