import 'dotenv/config';
import { createApp } from './app.js';
import { migrate, pool } from './db.js';

const port = Number(process.env.PORT || 3000);

await migrate();
const app = createApp();
const server = app.listen(port, () => {
  console.log(`Short URL server running on http://localhost:${port}`);
});

const shutdown = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
