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

// --dry-run mode: validate sample-transactions.json and print a summary table
if (require.main === module && process.argv.includes('--dry-run')) {
  const fs = require('fs');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');
  const samplePath = path.join(__dirname, '..', 'sample-transactions.json');
  const transactions = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

  const rows = transactions.map((txn) => {
    const message = {
      message_id: uuidv4(),
      timestamp: new Date().toISOString(),
      source_agent: 'dry_run',
      target_agent: 'transaction_validator',
      message_type: 'transaction',
      data: { ...txn },
    };
    const result = processMessage(message);
    return {
      transaction_id: txn.transaction_id,
      valid: result.data.status === 'validated',
      rejection_reason: result.data.rejection_reason || '',
    };
  });

  const valid = rows.filter((r) => r.valid).length;
  const invalid = rows.length - valid;

  console.log(`\nDry-run Validation Results`);
  console.log('='.repeat(55));
  console.log(`${'Transaction'.padEnd(12)} ${'Status'.padEnd(10)} Rejection Reason`);
  console.log('-'.repeat(55));
  for (const r of rows) {
    const status = r.valid ? 'VALID' : 'INVALID';
    console.log(`${r.transaction_id.padEnd(12)} ${status.padEnd(10)} ${r.rejection_reason}`);
  }
  console.log('='.repeat(55));
  console.log(`Total: ${rows.length}  Valid: ${valid}  Invalid: ${invalid}`);

  const reasons = {};
  for (const r of rows.filter((r) => !r.valid)) {
    reasons[r.rejection_reason] = (reasons[r.rejection_reason] || 0) + 1;
  }
  if (Object.keys(reasons).length > 0) {
    console.log('\nRejection reason breakdown:');
    for (const [reason, count] of Object.entries(reasons)) {
      console.log(`  ${reason}: ${count}`);
    }
  }
}
