'use strict';

const Decimal = require('decimal.js');

const AGENT_NAME = 'compliance_checker';

const SANCTIONED_ACCOUNTS = new Set(['ACC-SANC1', 'ACC-SANC2']);

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

  // Pass through already-rejected messages unchanged
  if (data.status === 'rejected') {
    auditLog(txnId, 'pass-through:already-rejected');
    return {
      ...message,
      source_agent: AGENT_NAME,
      target_agent: 'settlement_processor',
    };
  }

  // Check sanctioned accounts first (hard reject)
  if (
    SANCTIONED_ACCOUNTS.has(data.source_account) ||
    SANCTIONED_ACCOUNTS.has(data.destination_account)
  ) {
    auditLog(
      txnId,
      `rejected:SANCTIONED_ACCOUNT src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
    );
    return {
      ...message,
      source_agent: AGENT_NAME,
      target_agent: 'settlement_processor',
      data: { ...data, status: 'rejected', rejection_reason: 'SANCTIONED_ACCOUNT' },
    };
  }

  const updatedData = { ...data };

  // AML check: wire_transfer > $10,000
  const amt = new Decimal(data.amount);
  if (data.transaction_type === 'wire_transfer' && amt.gt(new Decimal('10000'))) {
    updatedData.compliance_flag = 'AML_REVIEW_REQUIRED';
    auditLog(
      txnId,
      `compliance_flag=AML_REVIEW_REQUIRED src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
    );
  } else {
    auditLog(
      txnId,
      `cleared src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
    );
  }

  updatedData.compliance_status = 'cleared';

  return {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: 'settlement_processor',
    data: updatedData,
  };
}

module.exports = { processMessage };
