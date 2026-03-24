'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const currencyConverter = require('../agents/currencyConverter');
const transactionValidator = require('../agents/transactionValidator');
const fraudDetector = require('../agents/fraudDetector');
const complianceChecker = require('../agents/complianceChecker');
const settlementProcessor = require('../agents/settlementProcessor');

const app = express();
app.use(express.json());

const BASE_DIR = path.join(__dirname, '..');
const SHARED_DIR = path.join(BASE_DIR, 'shared');
const RESULTS_DIR = path.join(SHARED_DIR, 'results');

const REQUIRED_FIELDS = [
  'amount',
  'currency',
  'source_account',
  'destination_account',
  'timestamp',
];

async function ensureResultsDir() {
  await fs.promises.mkdir(RESULTS_DIR, { recursive: true });
}

function wrapTransaction(txn) {
  return {
    message_id: uuidv4(),
    timestamp: new Date().toISOString(),
    source_agent: 'api_gateway',
    target_agent: 'currency_converter',
    message_type: 'transaction',
    data: { ...txn },
  };
}

async function runPipeline(txn) {
  let msg = wrapTransaction(txn);
  msg = currencyConverter.processMessage(msg);
  msg = transactionValidator.processMessage(msg);
  msg = fraudDetector.processMessage(msg);
  msg = complianceChecker.processMessage(msg);
  msg = await settlementProcessor.processMessage(msg, RESULTS_DIR);
  return msg.data;
}

// POST /api/transactions — submit a single transaction for processing
app.post('/api/transactions', async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const missingFields = REQUIRED_FIELDS.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missingFields.length > 0) {
    return res.status(400).json({ error: 'Missing required fields', missing_fields: missingFields });
  }

  const txn = {
    transaction_id: body.transaction_id || `API-${uuidv4()}`,
    ...body,
  };

  try {
    await ensureResultsDir();
    await runPipeline(txn);
    return res.status(201).json({ tracking_id: txn.transaction_id, status: 'accepted' });
  } catch (err) {
    return res.status(500).json({ error: 'Pipeline processing failed', details: err.message });
  }
});

// GET /api/transactions/:id/status — check processing status of a transaction
app.get('/api/transactions/:id/status', async (req, res) => {
  const txnId = req.params.id;
  const filePath = path.join(RESULTS_DIR, `${txnId}.json`);

  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    return res.status(200).json({
      transaction_id: data.transaction_id,
      status: data.status,
      details: data,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Transaction not found', transaction_id: txnId });
    }
    return res.status(500).json({ error: 'Failed to read transaction', details: err.message });
  }
});

// GET /api/results/details — list all processed transactions with full data
app.get('/api/results/details', async (req, res) => {
  try {
    await ensureResultsDir();
    const files = await fs.promises.readdir(RESULTS_DIR);
    const results = [];
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'pipeline-report.json') continue;
      const raw = await fs.promises.readFile(path.join(RESULTS_DIR, file), 'utf8');
      results.push(JSON.parse(raw));
    }
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read results', details: err.message });
  }
});

// GET /api/results — list all processed transactions
app.get('/api/results', async (req, res) => {
  try {
    await ensureResultsDir();
    const files = await fs.promises.readdir(RESULTS_DIR);
    const results = [];
    for (const file of files) {
      if (!file.endsWith('.json') || file === 'pipeline-report.json') continue;
      const raw = await fs.promises.readFile(path.join(RESULTS_DIR, file), 'utf8');
      const data = JSON.parse(raw);
      results.push({ transaction_id: data.transaction_id, status: data.status });
    }
    return res.status(200).json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read results', details: err.message });
  }
});

const PORT = process.env.PORT || 1234;

/* istanbul ignore next */
if (require.main === module) {
  ensureResultsDir()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`API server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
}

module.exports = { app, runPipeline };
