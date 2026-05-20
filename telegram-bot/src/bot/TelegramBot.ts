import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { MarketManager } from '../managers/MarketManager';
import { UserStateManager } from '../managers/UserStateManager';
import { BotMessages } from '../messages/BotMessages';
import { formatUsdc } from '../../../agent-framework/src/Blockchain/Signer';

export class AgentPredictionBot {
  public bot: Telegraf;
  private markets: MarketManager;
  private users: UserStateManager;

  constructor(token: string) {
    this.bot = new Telegraf(token);
    this.markets = new MarketManager();
    this.users = new UserStateManager();
    this._registerHandlers();
  }

  // ── Handler Registration ───────────────────────────────────────────────────

  private _registerHandlers(): void {
    this.bot.start(this._handleStart.bind(this));
    this.bot.help(this._handleHelp.bind(this));
    this.bot.command('create', this._handleCreate.bind(this));
    this.bot.command('markets', this._handleMarkets.bind(this));
    this.bot.command('bet', this._handleBet.bind(this));
    this.bot.command('results', this._handleResults.bind(this));
    this.bot.command('agentstats', this._handleAgentStats.bind(this));
    this.bot.command('wallet', this._handleWallet.bind(this));
    this.bot.command('resolve', this._handleResolve.bind(this));  // admin

    // Catch-all for unknown commands
    this.bot.on(message('text'), this._handleUnknown.bind(this));
  }

  // ── /start ─────────────────────────────────────────────────────────────────

  private async _handleStart(ctx: Context): Promise<void> {
    const username = ctx.from?.first_name ?? ctx.from?.username;
    await ctx.reply(BotMessages.welcome(username), { parse_mode: 'Markdown' });
  }

  // ── /help ──────────────────────────────────────────────────────────────────

  private async _handleHelp(ctx: Context): Promise<void> {
    await ctx.reply(BotMessages.help(), { parse_mode: 'Markdown' });
  }

  // ── /create <question> ─────────────────────────────────────────────────────
  // Usage: /create Will Bitcoin > $100K by December 2026?

  private async _handleCreate(ctx: Context): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const question = text.replace(/^\/create\s*/i, '').trim();

    if (!question || question.length < 10) {
      await ctx.reply(
        '❌ Please provide a question.\nExample: /create Will BTC reach $100K by June?',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (question.length > 280) {
      await ctx.reply('❌ Question too long (max 280 characters).');
      return;
    }

    // Immediately acknowledge — agent analysis takes time
    await ctx.reply(BotMessages.marketCreating(question), { parse_mode: 'Markdown' });

    // Run async — send follow-up when done
    this._createMarketAsync(ctx, question);
  }

  private async _createMarketAsync(ctx: Context, question: string): Promise<void> {
    const chatId = ctx.chat!.id;
    try {
      const result = await this.markets.createMarketFlow(question);
      await this.bot.telegram.sendMessage(
        chatId,
        BotMessages.marketCreated(result),
        { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message === 'TIMEOUT'
        ? BotMessages.timeout()
        : BotMessages.error(err instanceof Error ? err.message : 'Unknown error');
      await this.bot.telegram.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    }
  }

  // ── /markets ───────────────────────────────────────────────────────────────

  private async _handleMarkets(ctx: Context): Promise<void> {
    const markets = this.markets.getActiveMarkets();
    await ctx.reply(BotMessages.marketList(markets), { parse_mode: 'Markdown' });
  }

  // ── /bet <marketId> <yes|no> <amount> ──────────────────────────────────────
  // Usage: /bet 1 yes 50

  private async _handleBet(ctx: Context): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);

    if (parts.length < 4) {
      await ctx.reply(
        '❌ Usage: /bet <marketId> <yes|no> <amount>\nExample: /bet 1 yes 50',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const marketId = parseInt(parts[1]);
    const outcomeRaw = parts[2].toLowerCase();
    const amount = parseFloat(parts[3]);

    if (isNaN(marketId) || marketId < 1) {
      await ctx.reply('❌ Invalid market ID.');
      return;
    }
    if (outcomeRaw !== 'yes' && outcomeRaw !== 'no') {
      await ctx.reply('❌ Outcome must be `yes` or `no`.', { parse_mode: 'Markdown' });
      return;
    }
    if (isNaN(amount) || amount <= 0 || amount > 10_000) {
      await ctx.reply('❌ Amount must be between 1 and 10,000 USDC.');
      return;
    }

    const outcome = outcomeRaw.toUpperCase() as 'YES' | 'NO';
    const userId = String(ctx.from!.id);

    // Rate limit
    if (!this.users.canBet(userId)) {
      await ctx.reply(BotMessages.rateLimited());
      return;
    }

    // Get wallet — prefer registered, fall back to demo
    let wallet = this.users.hasWallet(userId)
      ? this.users.getWallet(userId)
      : this.users.getDemoWallet();

    if (!wallet) {
      await ctx.reply(BotMessages.noWallet(), { parse_mode: 'Markdown' });
      return;
    }

    // Check balance
    const { parseUsdc } = await import('../../../agent-framework/src/Blockchain/Signer');
    const amountBig = parseUsdc(amount);
    const { ethers } = await import('ethers');
    const { ERC20_ABI } = await import('../../../agent-framework/src/Blockchain/ContractABIs');
    const { getProvider } = await import('../../../agent-framework/src/Blockchain/Signer');
    const usdc = new ethers.Contract(
      process.env.USDC_ADDRESS || '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63',
      ERC20_ABI,
      getProvider()
    );
    const balance = await usdc.balanceOf(wallet.address) as bigint;
    if (balance < amountBig) {
      await ctx.reply(
        BotMessages.insufficientBalance(formatUsdc(balance), String(amount)),
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await ctx.reply(`⏳ Placing your ${outcome} bet of ${amount} USDC...`);

    try {
      const txHash = await this.markets.placeUserBet(wallet, marketId, outcome, amount);

      this.users.recordBet(userId, {
        marketId,
        outcome,
        amountUsdc: amount,
        txHash,
        timestamp: Date.now(),
      });

      await ctx.reply(
        BotMessages.betConfirmation(marketId, outcome, amount, txHash),
        { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } }
      );
    } catch (err: unknown) {
      await ctx.reply(
        BotMessages.betError(err instanceof Error ? err.message : 'Transaction failed'),
        { parse_mode: 'Markdown' }
      );
    }
  }

  // ── /results <marketId> ────────────────────────────────────────────────────

  private async _handleResults(ctx: Context): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);
    const marketId = parts[1] ? parseInt(parts[1]) : NaN;

    if (isNaN(marketId)) {
      // Show all active markets if no ID given
      await this._handleMarkets(ctx);
      return;
    }

    const data = await this.markets.getMarketResultData(marketId);
    if (!data) {
      await ctx.reply(BotMessages.error(`Market #${marketId} not found.`), { parse_mode: 'Markdown' });
      return;
    }

    await ctx.reply(BotMessages.results(marketId, data), {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });
  }

  // ── /agentstats ────────────────────────────────────────────────────────────

  private async _handleAgentStats(ctx: Context): Promise<void> {
    const stats = this.markets.getAgentStats();
    await ctx.reply(BotMessages.agentStats(stats), { parse_mode: 'Markdown' });
  }

  // ── /wallet <privateKey> ───────────────────────────────────────────────────

  private async _handleWallet(ctx: Context): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const privateKey = text.replace(/^\/wallet\s*/i, '').trim();

    if (!privateKey) {
      await ctx.reply(
        '⚠️ Usage: /wallet <privateKey>\n\n⚠️ Only use a testnet wallet from https://faucet.gokite.ai/',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const userId = String(ctx.from!.id);
    try {
      const address = this.users.registerWallet(userId, privateKey);
      const balance = await this.users.getUsdcBalance(userId);
      await ctx.reply(
        BotMessages.walletRegistered(address, formatUsdc(balance)),
        { parse_mode: 'Markdown' }
      );
    } catch {
      await ctx.reply('❌ Invalid private key. Make sure it starts with `0x`.', { parse_mode: 'Markdown' });
    }

    // Delete the message containing the private key for safety
    if (ctx.message?.message_id) {
      try {
        await ctx.deleteMessage(ctx.message.message_id);
      } catch {}
    }
  }

  // ── /resolve <marketId> <yes|no> ── (admin only) ───────────────────────────

  private async _handleResolve(ctx: Context): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const parts = text.trim().split(/\s+/);

    if (parts.length < 3) {
      await ctx.reply('Usage: /resolve <marketId> <yes|no>');
      return;
    }

    const marketId = parseInt(parts[1]);
    const outcomeStr = parts[2].toLowerCase();
    if (isNaN(marketId) || (outcomeStr !== 'yes' && outcomeStr !== 'no')) {
      await ctx.reply('❌ Usage: /resolve <marketId> <yes|no>');
      return;
    }

    await ctx.reply(`⏳ Resolving market #${marketId}...`);

    try {
      const { settleTx } = await this.markets.resolveAndSettle(marketId, outcomeStr === 'yes');
      const outcome = outcomeStr === 'yes' ? 'YES' : 'NO';
      await ctx.reply(
        BotMessages.marketResolved(marketId, outcome, settleTx),
        { parse_mode: 'Markdown', link_preview_options: { is_disabled: true } }
      );
    } catch (err: unknown) {
      await ctx.reply(
        BotMessages.error(err instanceof Error ? err.message : 'Settlement failed'),
        { parse_mode: 'Markdown' }
      );
    }
  }

  // ── Unknown input ──────────────────────────────────────────────────────────

  private async _handleUnknown(ctx: Context): Promise<void> {
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    // Ignore non-command messages unless they look like a stray command
    if (text.startsWith('/')) {
      await ctx.reply(BotMessages.error(`Unknown command: ${text.split(' ')[0]}`), {
        parse_mode: 'Markdown',
      });
    }
  }
}
