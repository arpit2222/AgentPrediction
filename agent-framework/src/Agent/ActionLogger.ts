import fs from 'fs';
import path from 'path';
import type { ActionLog } from '../types';

const LOG_FILE = path.join(process.cwd(), 'agent-actions.jsonl');

/**
 * ActionLogger: writes every agent decision to:
 *   1. A local JSONL file (agent-actions.jsonl) — queryable audit trail
 *   2. Console with structured output
 *
 * Each log entry is a self-contained JSON line, making it easy to:
 *   - Stream to Goldsky via webhook
 *   - Parse for the demo dashboard
 *   - Provide as on-chain attestation evidence
 */
export class ActionLogger {
  private agentId: string;
  private logs: ActionLog[] = [];

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  log(
    action: string,
    payload: Record<string, unknown>,
    result: Record<string, unknown>,
    txHash?: string
  ): ActionLog {
    const entry: ActionLog = {
      agentId: this.agentId,
      action,
      payload,
      result,
      txHash,
      timestamp: Date.now(),
    };

    this.logs.push(entry);
    this._writeToFile(entry);
    this._printToConsole(entry);

    return entry;
  }

  getAll(): ActionLog[] {
    return [...this.logs];
  }

  getLast(): ActionLog | undefined {
    return this.logs[this.logs.length - 1];
  }

  // ── File & Console ─────────────────────────────────────────────────────────

  private _writeToFile(entry: ActionLog): void {
    try {
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
    } catch {
      // Non-fatal — don't crash agent if FS write fails
    }
  }

  private _printToConsole(entry: ActionLog): void {
    const ts = new Date(entry.timestamp).toISOString();
    const txTag = entry.txHash ? ` | tx: ${entry.txHash.slice(0, 10)}...` : '';
    console.log(`[${ts}] [${entry.agentId}] ${entry.action}${txTag}`);
    if (Object.keys(entry.payload).length) {
      console.log('  payload:', JSON.stringify(entry.payload, this._replaceBigInt));
    }
    if (Object.keys(entry.result).length) {
      console.log('  result: ', JSON.stringify(entry.result, this._replaceBigInt));
    }
  }

  private _replaceBigInt(_key: string, value: unknown): unknown {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  // ── Static utility: read all logs from file ────────────────────────────────

  static readAll(filePath: string = LOG_FILE): ActionLog[] {
    if (!fs.existsSync(filePath)) return [];
    return fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ActionLog);
  }
}
