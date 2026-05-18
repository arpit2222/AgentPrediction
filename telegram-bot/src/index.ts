import 'dotenv/config';
import { AgentPredictionBot } from './bot/TelegramBot';
import { createWebhookApp } from './api/webhookHandler';

const TOKEN = process.env.TELEGRAM_TOKEN;
const WEBHOOK_URL = process.env.BOT_WEBHOOK_URL;
const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  if (!TOKEN) {
    console.error('Error: TELEGRAM_TOKEN not set in .env');
    process.exit(1);
  }

  const bot = new AgentPredictionBot(TOKEN);

  if (WEBHOOK_URL) {
    // ── Webhook mode (Vercel / production) ────────────────────────────────
    const app = createWebhookApp();

    await bot.bot.telegram.setWebhook(`${WEBHOOK_URL}`);
    console.log(`✅ Webhook set: ${WEBHOOK_URL}`);

    app.listen(PORT, () => {
      console.log(`🚀 AgentPrediction Bot running in webhook mode on port ${PORT}`);
    });
  } else {
    // ── Polling mode (local development) ─────────────────────────────────
    console.log('🔄 Starting bot in polling mode (no BOT_WEBHOOK_URL set)...');

    await bot.bot.telegram.deleteWebhook();
    await bot.bot.launch();

    console.log('✅ AgentPrediction Bot is running in polling mode');
    console.log('Send /start to your bot on Telegram to test it');

    // Graceful shutdown
    process.once('SIGINT', () => bot.bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.bot.stop('SIGTERM'));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
