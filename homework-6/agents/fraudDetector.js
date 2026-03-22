'use strict';

const Decimal = require('decimal.js');

const AGENT_NAME = 'fraud_detector';

const KNOWN_FRAUD_ACCOUNTS = new Set(['ACC-9999', 'ACC-0000', 'ACC-1111']);

function maskAccount(account) {
  if (!account || account.length < 4) return '****';
  return account.slice(0, 4) + '****';
}

function auditLog(txnId, outcome) {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${AGENT_NAME}] txn=${txnId} outcome=${outcome}\n`);
}

function getRiskLevel(score) {
  if (score <= 2) return 'LOW';
  if (score <= 6) return 'MEDIUM';
  return 'HIGH';
}

function processMessage(message) {
  const data = message.data;
  const txnId = data.transaction_id || 'UNKNOWN';

  // Pass through already-rejected messages unchanged
  if (data.status === 'rejected') {
    auditLog(txnId, 'pass-through:already-rejected');
    return {
      ...message,
      source_agent: AGENT_NAME,
      target_agent: 'compliance_checker',
    };
  }

  let score = 0;
  const amt = new Decimal(data.amount);

  // Amount scoring
  if (amt.gt(new Decimal('50000'))) {
    score += 7; // +3 for >10k, +4 for >50k
  } else if (amt.gt(new Decimal('10000'))) {
    score += 3;
  }

  // Unusual hour: 2–4 AM UTC
  const hour = new Date(data.timestamp).getUTCHours();
  if (hour >= 2 && hour < 4) {
    score += 2;
  }

  // Cross-border or non-USD
  if (data.currency !== 'USD') {
    score += 1;
  } else if (data.metadata && data.metadata.country && data.metadata.country !== 'US') {
    score += 1;
  }

  // Known fraud accounts
  if (
    KNOWN_FRAUD_ACCOUNTS.has(data.source_account) ||
    KNOWN_FRAUD_ACCOUNTS.has(data.destination_account)
  ) {
    score += 2;
  }

  const riskLevel = getRiskLevel(score);

  auditLog(
    txnId,
    `scored score=${score} risk=${riskLevel} src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
  );

  return {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: 'compliance_checker',
    data: {
      ...data,
      fraud_risk_score: score,
      fraud_risk_level: riskLevel,
    },
  };
}

module.exports = { processMessage };
