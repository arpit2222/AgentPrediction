// Vercel serverless function — entry point for Telegram webhook
import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { AgentPredictionBot } from '../src/bot/TelegramBot';

let bot: AgentPredictionBot | null = null;

function getBot(): AgentPredictionBot {
  if (!bot) {
    const token = process.env.TELEGRAM_TOKEN;
    if (!token) throw new Error('TELEGRAM_TOKEN not set');
    bot = new AgentPredictionBot(token);
  }
  return bot;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(200).json({ status: 'AgentPrediction bot is running' });
    return;
  }

  // Acknowledge Telegram immediately
  res.status(200).json({ ok: true });

  // Process update — bot sends replies via Telegram API directly (not via response body)
  try {
    await getBot().bot.handleUpdate(req.body);
  } catch (err) {
    console.error('[Vercel handler] Error processing update:', err);
  }
}
