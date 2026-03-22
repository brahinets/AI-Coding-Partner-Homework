'use strict';

const fs = require('fs');
const path = require('path');

const AGENT_NAME = 'reporting_agent';

function auditLog(outcome) {
  const ts = new Date().toISOString();
  process.stderr.write(`[${ts}] [${AGENT_NAME}] outcome=${outcome}\n`);
}

async function generateReport(resultsDir) {
  const files = await fs.promises.readdir(resultsDir);
  const txnFiles = files.filter((f) => f.endsWith('.json') && f !== 'pipeline-report.json');

  const transactions = [];
  for (const file of txnFiles) {
    const raw = await fs.promises.readFile(path.join(resultsDir, file), 'utf8');
    transactions.push(JSON.parse(raw));
  }

  const report = {
    generated_at: new Date().toISOString(),
    total_transactions: transactions.length,
    settled_count: 0,
    rejected_count: 0,
    by_risk_level: { LOW: 0, MEDIUM: 0, HIGH: 0, 'N/A': 0 },
    rejection_reasons: {},
    aml_review_required: [],
  };

  for (const txn of transactions) {
    if (txn.status === 'settled') {
      report.settled_count++;
    } else {
      report.rejected_count++;
    }

    const risk = txn.fraud_risk_level || 'N/A';
    if (report.by_risk_level[risk] !== undefined) {
      report.by_risk_level[risk]++;
    } else {
      report.by_risk_level[risk] = 1;
    }

    if (txn.rejection_reason) {
      report.rejection_reasons[txn.rejection_reason] =
        (report.rejection_reasons[txn.rejection_reason] || 0) + 1;
    }

    if (txn.compliance_flag === 'AML_REVIEW_REQUIRED') {
      report.aml_review_required.push(txn.transaction_id);
    }
  }

  const reportPath = path.join(resultsDir, 'pipeline-report.json');
  await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  auditLog(`report generated total=${report.total_transactions} settled=${report.settled_count} rejected=${report.rejected_count}`);

  return report;
}

module.exports = { generateReport };
