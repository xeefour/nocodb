import dns from 'node:dns';
import cors from 'cors';
import express from 'express';
import path from 'path';
import Noco from '~/Noco';
import { handleUncaughtErrors } from '~/utils';
handleUncaughtErrors(process);

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

// Set NC_GUI_DIST_PATH so GuiMiddleware (middlewares/gui/gui.middleware.ts)
// can serve the built frontend. The CE entrypoint omits this; the EE
// entrypoint (and src/run/local.ts / cloud.ts) set it explicitly. Default
// to /usr/src/app/docker/nc-gui, which is where the official Docker
// image and our Dockerfile.local place the Nuxt output.
process.env.NC_GUI_DIST_PATH =
  process.env.NC_GUI_DIST_PATH ||
  path.join(__dirname, 'nc-gui');

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders:
      'xc-db-response, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Policy, Retry-After',
  }),
);

server.set('view engine', 'ejs');

process.env[`DEBUG`] = 'xc*';

// (async () => {
//   await nocobuild(server);
//   const httpServer = server.listen(process.env.PORT || 8080, async () => {
//     console.log('Server started');
//   });
// })().catch((e) => console.log(e));

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
