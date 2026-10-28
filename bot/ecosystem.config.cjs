// Configuración de pm2 para el bot. Arranca con: pm2 start ecosystem.config.cjs
// (en Windows, `pm2 start npm -- start` no reenvía bien los argumentos).
module.exports = {
  apps: [
    {
      name: 'aura-bot',
      script: 'src/index.js',
      cwd: __dirname,
      // El .env lo lee Node, no pm2: así las variables no dependen del entorno del daemon.
      node_args: '--env-file=.env',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      time: true,
    },
  ],
}
