module.exports = {
  apps: [{
    name: 'softaware-backend',
    script: './dist/index.js',
    cwd: '/var/opt/backend',
    env_file: '/var/opt/backend/.env',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '4000M',
    env: {
      NODE_OPTIONS: '--max-old-space-size=4096'
    },
    error_file: '/root/.pm2/logs/softaware-backend-error.log',
    out_file: '/root/.pm2/logs/softaware-backend-out.log',
    log_date_format: 'YYYY-MM-DDTHH:mm:ss',
    merge_logs: true
  }]
};
