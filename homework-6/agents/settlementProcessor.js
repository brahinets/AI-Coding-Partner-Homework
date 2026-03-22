'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const AGENT_NAME = 'settlement_processor';

function maskAccount(account) {
  if (!account || account.length < 4) return '****';
  return account.slice(0, 4) + '****';
}

function auditLog(txnId, outcome) {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${AGENT_NAME}] txn=${txnId} outcome=${outcome}\n`);
}

async function processMessage(message, resultsDir) {
  const data = message.data;
  const txnId = data.transaction_id || 'UNKNOWN';

  let updatedData = { ...data };

  if (data.status === 'rejected') {
    // Already rejected — write result as-is
    auditLog(
      txnId,
      `rejected reason=${data.rejection_reason} src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
    );
  } else if (data.fraud_risk_level === 'HIGH') {
    updatedData.status = 'rejected';
    updatedData.rejection_reason = 'FRAUD_RISK_HIGH';
    auditLog(
      txnId,
      `rejected:FRAUD_RISK_HIGH src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
    );
  } else {
    // MEDIUM or LOW — settle
    updatedData.status = 'settled';
    updatedData.settlement_id = uuidv4();
    updatedData.settlement_timestamp = new Date().toISOString();
    if (data.fraud_risk_level === 'MEDIUM') {
      updatedData.review_flag = true;
    }
    auditLog(
      txnId,
      `settled risk=${data.fraud_risk_level} settlement_id=${updatedData.settlement_id} src=${maskAccount(data.source_account)} dst=${maskAccount(data.destination_account)}`,
    );
  }

  const finalMessage = {
    ...message,
    source_agent: AGENT_NAME,
    target_agent: 'reporting_agent',
    data: updatedData,
  };

  // Write result file
  const outPath = path.join(resultsDir, `${txnId}.json`);
  await fs.promises.writeFile(outPath, JSON.stringify(finalMessage.data, null, 2), 'utf8');

  return finalMessage;
}

module.exports = { processMessage };
