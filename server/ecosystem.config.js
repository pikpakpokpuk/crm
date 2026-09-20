module.exports = {
  apps: [
    {
      name: 'crm-server',
      script: 'dist/server.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      time: true, // timestamp log lines
      env: {
        NODE_ENV: 'production',
        TRUST_PROXY: '1', // running behind Caddy
      },
    },
  ],
};
