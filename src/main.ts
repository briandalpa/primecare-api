import { configDotenv } from 'dotenv';
import { app } from '@/application/app';
import { logger } from '@/application/logging';

configDotenv();

const PORT = process.env.PORT;

(async () => {
  try {
    const server = app.listen(PORT, () => {
      logger.info(`Listening on Port: ${PORT}`);
    });

    const shutdown = () => {
      logger.info('Shutting down...');
      server.close(() => process.exit(0));
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('❌ Failed to start server', error);
    process.exit(1);
  }
})();
