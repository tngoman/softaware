const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  // Proxy /api and /auth to the backend on 8787
  app.use(
    ['/api', '/auth'],
    createProxyMiddleware({
      target: 'http://127.0.0.1:8787',
      changeOrigin: true,
    })
  );
};
