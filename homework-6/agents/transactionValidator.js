'use strict';

const Decimal = require('decimal.js');

const AGENT_NAME = 'transaction_validator';

const REQUIRED_FIELDS = [
  'transaction_id',
  'amount',
  'currency',
  'source_account',
  'destination_account',
  'timestamp',
];

const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF',
  'CNY', 'HKD', 'NZD', 'SEK', 'SGD', 'NOK', 'DKK',
]);

function maskAccount(account) {
  if (!account || account.length < 4) return '****';
  return account.slice(0, 4) + '****';
}

function auditLog(txnId, outcome) {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${AGENT_NAME}] txn=${txnId} outcome=${outcome}\n`);
}

function processMessage(message) {
  const data = message.data;
  const txnId = data.transaction_id || 'UNKNOWN';

  // Check required fields
  const missingFields = REQUIRED_FIELDS.filter((f) => !data[f] && data[f] !== 0);
  if (missingFields.length > 0) {
    auditLog(txnId, 'rejected:MISSING_FIELDS');
    return {
      ...message,
      source_agent: AGENT_NAME,
      target_agent: 'fraud_detector',
      data: { ...data, status: 'rejected', rejection_reason: 'MISSING_FIELDS' },
    };
  }

  // Validate amount: must be parseable as a positive decimal
  let amt;
  try {
    amt = new Decimal(data.amount);
  } catch (e) {
    auditLog(txnId, 'rejected:INVALID_AMOUNT');
    return {
      ...message,
      source_agent: AGENT_NAME,
      target_agent: 'fraud_detector',
      data: { ...data, status: 'rejected', rejection_reason: 'INVALID_AMOUNT' },
    };
  }

  if (amt.lte(new Decimal('0'))) {
    auditLog(txnId, 'rejected:INVALID_AMOUNT');
    return {
      ...message,
      source_agent: AGENT_NAME,
      target_agent: 'fraud_detector',
      data: { ...data, status: 'rejected', rejection_reason: 'INVALID_AMOUNT' },
    };
  }

  // Validate currency
  if (!VALID_CURRENCIES.has(data.currency)) {
    auditLog(
      txnId,
      `rejected:INVALID_CURRENCY src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
    );
    return {
      ...message,
      source_agent: AGENT_NAME,
      target_agent: 'fraud_detector',
      data: { ...data, status: 'rejected', rejection_reason: 'INVALID_CURRENCY' },
    };
  }

  auditLog(
    txnId,
    `validated src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
  );
  return {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: 'fraud_detector',
    data: { ...data, status: 'validated' },
  };
}

module.exports = { processMessage };
