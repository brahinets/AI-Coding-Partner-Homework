'use strict';

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const currencyConverter = require('./agents/currencyConverter');
const transactionValidator = require('./agents/transactionValidator');
const fraudDetector = require('./agents/fraudDetector');
const complianceChecker = require('./agents/complianceChecker');
const settlementProcessor = require('./agents/settlementProcessor');
const reportingAgent = require('./agents/reportingAgent');

const BASE_DIR = __dirname;
const SHARED_DIR = path.join(BASE_DIR, 'shared');
const RESULTS_DIR = path.join(SHARED_DIR, 'results');
const SAMPLE_FILE = path.join(BASE_DIR, 'sample-transactions.json');

async function ensureDirs() {
  const dirs = [
    path.join(SHARED_DIR, 'input'),
    path.join(SHARED_DIR, 'converted'),
    path.join(SHARED_DIR, 'output'),
    path.join(SHARED_DIR, 'processing'),
    path.join(SHARED_DIR, 'compliance'),
    RESULTS_DIR,
  ];
  for (const dir of dirs) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
}

async function clearDir(dir) {
  const files = await fs.promises.readdir(dir);
  for (const f of files) {
    await fs.promises.unlink(path.join(dir, f));
  }
}

async function clearAll() {
  for (const sub of ['input', 'converted', 'output', 'processing', 'compliance', 'results']) {
    await clearDir(path.join(SHARED_DIR, sub));
  }
}

function wrapTransaction(txn) {
  return {
    message_id: uuidv4(),
    timestamp: new Date().toISOString(),
    source_agent: 'integrator',
    target_agent: 'transaction_validator',
    message_type: 'transaction',
    data: { ...txn },
  };
}

async function writeMessage(dir, filename, message) {
  await fs.promises.writeFile(
    path.join(dir, filename),
    JSON.stringify(message, null, 2),
    'utf8',
  );
}

async function readMessage(dir, filename) {
  const raw = await fs.promises.readFile(path.join(dir, filename), 'utf8');
  return JSON.parse(raw);
}

async function run() {
  console.log('=== Banking Pipeline Starting ===\n');

  await ensureDirs();
  await clearAll();

  // Load sample transactions
  const raw = await fs.promises.readFile(SAMPLE_FILE, 'utf8');
  const transactions = JSON.parse(raw);
  console.log(`Loaded ${transactions.length} transactions from sample-transactions.json\n`);

  const INPUT_DIR      = path.join(SHARED_DIR, 'input');
  const CONVERTED_DIR  = path.join(SHARED_DIR, 'converted');
  const OUTPUT_DIR     = path.join(SHARED_DIR, 'output');
  const PROCESSING_DIR = path.join(SHARED_DIR, 'processing');
  const COMPLIANCE_DIR = path.join(SHARED_DIR, 'compliance');

  // Drop all raw messages into shared/input/
  for (const txn of transactions) {
    const message = wrapTransaction(txn);
    await writeMessage(INPUT_DIR, `${txn.transaction_id}.json`, message);
  }
  console.log(`Dropped ${transactions.length} messages into shared/input/\n`);

  const results = [];

  for (const txn of transactions) {
    const filename = `${txn.transaction_id}.json`;

    // Stage 0: Currency conversion — read from input, write to converted
    let message = await readMessage(INPUT_DIR, filename);
    message = currencyConverter.processMessage(message);
    await writeMessage(CONVERTED_DIR, filename, message);

    // Stage 1: Validate — read from converted, write to output
    message = await readMessage(CONVERTED_DIR, filename);
    message = transactionValidator.processMessage(message);
    await writeMessage(OUTPUT_DIR, filename, message);

    // Stage 2: Fraud detection — read from output, write to processing
    message = await readMessage(OUTPUT_DIR, filename);
    message = fraudDetector.processMessage(message);
    await writeMessage(PROCESSING_DIR, filename, message);

    // Stage 3: Compliance — read from processing, write to compliance
    message = await readMessage(PROCESSING_DIR, filename);
    message = complianceChecker.processMessage(message);
    await writeMessage(COMPLIANCE_DIR, filename, message);

    // Stage 4: Settlement — read from compliance, write to results
    message = await readMessage(COMPLIANCE_DIR, filename);
    message = await settlementProcessor.processMessage(message, RESULTS_DIR);

    results.push(message.data);
  }

  // Stage 5: Generate report
  const report = await reportingAgent.generateReport(RESULTS_DIR);

  // Print summary
  console.log('=== Pipeline Complete ===\n');
  console.log('Transaction Results:');
  console.log('-'.repeat(70));

  for (const r of results) {
    const status = r.status.toUpperCase().padEnd(10);
    const risk = (r.fraud_risk_level || 'N/A').padEnd(8);
    const reason = r.rejection_reason ? ` [${r.rejection_reason}]` : '';
    const aml = r.compliance_flag === 'AML_REVIEW_REQUIRED' ? ' [AML_REVIEW]' : '';
    const review = r.review_flag ? ' [REVIEW_FLAG]' : '';
    console.log(`${r.transaction_id}  ${status}  risk=${risk}${reason}${aml}${review}`);
  }

  console.log('-'.repeat(70));
  console.log(`\nSummary:`);
  console.log(`  Total:    ${report.total_transactions}`);
  console.log(`  Settled:  ${report.settled_count}`);
  console.log(`  Rejected: ${report.rejected_count}`);
  console.log(`\nBy Risk Level:`, report.by_risk_level);
  console.log(`Rejection Reasons:`, report.rejection_reasons);
  if (report.aml_review_required.length > 0) {
    console.log(`AML Review Required:`, report.aml_review_required);
  }
  console.log(`\nReport written to shared/results/pipeline-report.json`);
}

run().catch((err) => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
