module.exports = {
  apps: [
    {
      name: 'api-share',
      script: 'src/app.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        PROXY_ENABLED: 'true',
      },
      max_memory_restart: '512M',
    },
  ],
};
