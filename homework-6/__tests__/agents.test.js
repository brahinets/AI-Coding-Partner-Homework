'use strict';

jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));

const path = require('path');
const os = require('os');
const fs = require('fs');

const fraudDetector = require('../agents/fraudDetector');
const complianceChecker = require('../agents/complianceChecker');
const settlementProcessor = require('../agents/settlementProcessor');

function makeMessage(data) {
  return {
    message_id: 'test-id',
    timestamp: new Date().toISOString(),
    source_agent: 'test',
    target_agent: 'agent',
    message_type: 'transaction',
    data,
  };
}

const baseTxn = {
  transaction_id: 'TXN001',
  amount: '500.00',
  currency: 'USD',
  source_account: 'ACC-1234',
  destination_account: 'ACC-5678',
  timestamp: '2026-03-23T10:00:00.000Z',
  status: 'validated',
  fraud_risk_level: 'LOW',
  fraud_risk_score: 0,
};

// ─── Fraud Detector ───────────────────────────────────────────────────────────

describe('fraudDetector', () => {
  test('passes through already-rejected messages', () => {
    const msg = makeMessage({ ...baseTxn, status: 'rejected' });
    const result = fraudDetector.processMessage(msg);
    expect(result.target_agent).toBe('compliance_checker');
    expect(result.data.status).toBe('rejected');
  });

  test('scores LOW for a normal transaction', () => {
    const result = fraudDetector.processMessage(makeMessage({ ...baseTxn }));
    expect(result.data.fraud_risk_level).toBe('LOW');
  });

  test('scores HIGH for amount > 50000', () => {
    const result = fraudDetector.processMessage(makeMessage({ ...baseTxn, amount: '60000' }));
    expect(result.data.fraud_risk_level).toBe('HIGH');
  });

  test('scores MEDIUM for amount > 10000', () => {
    const result = fraudDetector.processMessage(makeMessage({ ...baseTxn, amount: '20000' }));
    expect(result.data.fraud_risk_level).toBe('MEDIUM');
  });

  test('adds score for unusual hour (2-4 AM UTC)', () => {
    const msg = makeMessage({ ...baseTxn, timestamp: '2026-03-23T03:00:00.000Z' });
    const result = fraudDetector.processMessage(msg);
    expect(result.data.fraud_risk_score).toBeGreaterThan(0);
  });

  test('adds score for non-USD currency', () => {
    const result = fraudDetector.processMessage(makeMessage({ ...baseTxn, currency: 'EUR' }));
    expect(result.data.fraud_risk_score).toBeGreaterThan(0);
  });

  test('adds score for known fraud account', () => {
    const result = fraudDetector.processMessage(makeMessage({ ...baseTxn, source_account: 'ACC-9999' }));
    expect(result.data.fraud_risk_score).toBeGreaterThan(0);
  });

  test('adds score for USD with non-US country metadata', () => {
    const result = fraudDetector.processMessage(makeMessage({ ...baseTxn, metadata: { country: 'DE' } }));
    expect(result.data.fraud_risk_score).toBeGreaterThan(0);
  });
});

// ─── Compliance Checker ───────────────────────────────────────────────────────

describe('complianceChecker', () => {
  test('passes through already-rejected messages', () => {
    const msg = makeMessage({ ...baseTxn, status: 'rejected' });
    const result = complianceChecker.processMessage(msg);
    expect(result.target_agent).toBe('settlement_processor');
    expect(result.data.status).toBe('rejected');
  });

  test('rejects sanctioned source account', () => {
    const result = complianceChecker.processMessage(makeMessage({ ...baseTxn, source_account: 'ACC-SANC1' }));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');
  });

  test('rejects sanctioned destination account', () => {
    const result = complianceChecker.processMessage(makeMessage({ ...baseTxn, destination_account: 'ACC-SANC2' }));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');
  });

  test('flags AML for wire_transfer > 10000', () => {
    const result = complianceChecker.processMessage(makeMessage({ ...baseTxn, transaction_type: 'wire_transfer', amount: '15000' }));
    expect(result.data.compliance_flag).toBe('AML_REVIEW_REQUIRED');
  });

  test('clears normal transaction', () => {
    const result = complianceChecker.processMessage(makeMessage({ ...baseTxn }));
    expect(result.data.compliance_status).toBe('cleared');
    expect(result.data.compliance_flag).toBeUndefined();
  });
});

// ─── Settlement Processor ─────────────────────────────────────────────────────

describe('settlementProcessor', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settlement-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test('settles a LOW risk transaction', async () => {
    const result = await settlementProcessor.processMessage(makeMessage({ ...baseTxn }), tmpDir);
    expect(result.data.status).toBe('settled');
    expect(result.data.settlement_id).toBeDefined();
  });

  test('settles MEDIUM risk with review_flag', async () => {
    const msg = makeMessage({ ...baseTxn, fraud_risk_level: 'MEDIUM' });
    const result = await settlementProcessor.processMessage(msg, tmpDir);
    expect(result.data.status).toBe('settled');
    expect(result.data.review_flag).toBe(true);
  });

  test('rejects HIGH risk transaction', async () => {
    const msg = makeMessage({ ...baseTxn, fraud_risk_level: 'HIGH' });
    const result = await settlementProcessor.processMessage(msg, tmpDir);
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('FRAUD_RISK_HIGH');
  });

  test('passes through already-rejected messages', async () => {
    const msg = makeMessage({ ...baseTxn, status: 'rejected', rejection_reason: 'INVALID_AMOUNT' });
    const result = await settlementProcessor.processMessage(msg, tmpDir);
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
  });

  test('writes result file to resultsDir', async () => {
    await settlementProcessor.processMessage(makeMessage({ ...baseTxn }), tmpDir);
    const files = fs.readdirSync(tmpDir);
    expect(files).toContain('TXN001.json');
  });
});
