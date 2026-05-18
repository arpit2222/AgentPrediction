import express, { Request, Response } from 'express';
import { AgentPredictionBot } from '../bot/TelegramBot';

let botInstance: AgentPredictionBot | null = null;

function getBot(): AgentPredictionBot {
  if (!botInstance) {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) throw new Error('TELEGRAM_TOKEN not set');
    botInstance = new AgentPredictionBot(token);
  }
  return botInstance;
}

export function createWebhookApp(): express.Application {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'AgentPrediction Bot', timestamp: new Date().toISOString() });
  });

  // Telegram webhook endpoint
  app.post('/api/telegram', (req: Request, res: Response) => {
    // Respond 200 immediately — Telegram requires this within 5 seconds
    res.sendStatus(200);

    // Process update async (bot sends follow-up messages independently)
    try {
      getBot().bot.handleUpdate(req.body);
    } catch (err) {
      console.error('Webhook handler error:', err);
    }
  });

  return app;
}

export { getBot };
