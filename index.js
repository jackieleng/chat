'use strict'
// TODO: rewrite using ws?
//https://stackoverflow.com/questions/10112178/differences-between-socket-io-and-websockets/38558531#38558531

const cluster = require('cluster');
const fs = require('fs');
const util = require('util');
const Koa = require('koa');
const Router = require('koa-router');
const readFile = util.promisify(fs.readFile);
const port = process.env.PORT || 3000;
const numCPUs = require('os').cpus().length;
const numWorkers = process.env.NUM_WORKERS || numCPUs;
const redis = require('socket.io-redis');
const redisHost = 'localhost';
const redisPort = 6379;

if (cluster.isMaster) {
  console.log(`Master (pid ${process.pid}) is running`);

  // Fork workers.
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  // Worker code
  const app = new Koa();
  const server = require('http').createServer(app.callback());
  const io = require('socket.io')(server);
  const router = new Router();
  // use redis pubsub adapter to share messages between processes
  io.adapter(redis({ host: redisHost, port: redisPort }));

  router.get('/', async function(ctx) {
    // TODO: switch out for some better way to serve HTML
    ctx.type = 'html';
    ctx.body = await readFile(`${__dirname}/index.html`);
  });

  app
    .use(router.routes())
    .use(router.allowedMethods());

  io.on('connection', function(socket) {
    console.log(`a user connected to worker ${cluster.worker.id}`);

    socket.on('disconnect', function() {
      console.log('user disconnected');
    });

    socket.on('chat message', function(msg) {
      console.log('message: ' + msg);
      io.emit('chat message', msg);
    });
  });

  server.listen(port, function() {
    console.log(`Worker ${cluster.worker.id} (pid ${process.pid}) listening on *:${port}`)
  });

}
