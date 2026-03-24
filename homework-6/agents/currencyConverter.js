'use strict';

const Decimal = require('decimal.js');

const AGENT_NAME = 'currency_converter';

// Conversion rates to USD.
// Hardcoded here; will be loaded from config/rules.json in Task A2.
const RATES_TO_USD = {
  USD: new Decimal('1'),
  EUR: new Decimal('1.08'),
  UAH: new Decimal('0.024'),
};

const SUPPORTED_CURRENCIES = new Set(Object.keys(RATES_TO_USD));

function auditLog(txnId, outcome) {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${AGENT_NAME}] txn=${txnId} outcome=${outcome}\n`);
}

function processMessage(message) {
  const data = message.data;
  const txnId = data.transaction_id || 'UNKNOWN';
  const currency = data.currency;

  const out = {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: 'transaction_validator',
  };

  // Pass through already-rejected messages unchanged
  if (data.status === 'rejected') {
    auditLog(txnId, 'pass-through:already-rejected');
    return out;
  }

  // Currency not in supported set — pass through; validator will reject it
  if (!SUPPORTED_CURRENCIES.has(currency)) {
    auditLog(txnId, `pass-through:unsupported-currency=${currency}`);
    return out;
  }

  // USD — no conversion needed
  if (currency === 'USD') {
    auditLog(txnId, 'pass-through:already-usd');
    return out;
  }

  // Convert to USD
  const rate = RATES_TO_USD[currency];
  const originalAmount = new Decimal(data.amount);
  const convertedAmount = originalAmount.times(rate).toDecimalPlaces(2);

  auditLog(
    txnId,
    `converted ${data.amount} ${currency} -> ${convertedAmount.toFixed(2)} USD rate=${rate.toFixed(4)}`,
  );

  return {
    ...out,
    data: {
      ...data,
      amount: convertedAmount.toFixed(2),
      currency: 'USD',
      original_amount: data.amount,
      original_currency: currency,
      conversion_rate: rate.toFixed(4),
    },
  };
}

module.exports = { processMessage };
