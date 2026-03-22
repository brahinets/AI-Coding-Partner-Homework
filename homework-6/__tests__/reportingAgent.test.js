'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { generateReport } = require('../agents/reportingAgent');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true });
});

function writeTxn(dir, filename, data) {
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(data), 'utf8');
}

test('generates report with settled and rejected counts', async () => {
  writeTxn(tmpDir, 'TXN001.json', { transaction_id: 'TXN001', status: 'settled', fraud_risk_level: 'LOW' });
  writeTxn(tmpDir, 'TXN002.json', { transaction_id: 'TXN002', status: 'rejected', rejection_reason: 'FRAUD_RISK_HIGH', fraud_risk_level: 'HIGH' });

  const report = await generateReport(tmpDir);
  expect(report.total_transactions).toBe(2);
  expect(report.settled_count).toBe(1);
  expect(report.rejected_count).toBe(1);
  expect(report.by_risk_level.LOW).toBe(1);
  expect(report.by_risk_level.HIGH).toBe(1);
  expect(report.rejection_reasons.FRAUD_RISK_HIGH).toBe(1);
});

test('tracks AML review required transactions', async () => {
  writeTxn(tmpDir, 'TXN003.json', { transaction_id: 'TXN003', status: 'settled', fraud_risk_level: 'MEDIUM', compliance_flag: 'AML_REVIEW_REQUIRED' });

  const report = await generateReport(tmpDir);
  expect(report.aml_review_required).toContain('TXN003');
});

test('skips pipeline-report.json when reading transactions', async () => {
  writeTxn(tmpDir, 'TXN001.json', { transaction_id: 'TXN001', status: 'settled', fraud_risk_level: 'LOW' });
  writeTxn(tmpDir, 'pipeline-report.json', { total_transactions: 999 });

  const report = await generateReport(tmpDir);
  expect(report.total_transactions).toBe(1);
});

test('handles unknown risk level', async () => {
  writeTxn(tmpDir, 'TXN004.json', { transaction_id: 'TXN004', status: 'rejected', rejection_reason: 'MISSING_FIELDS' });

  const report = await generateReport(tmpDir);
  expect(report.by_risk_level['N/A']).toBe(1);
});

test('writes pipeline-report.json to resultsDir', async () => {
  writeTxn(tmpDir, 'TXN001.json', { transaction_id: 'TXN001', status: 'settled', fraud_risk_level: 'LOW' });

  await generateReport(tmpDir);
  const files = fs.readdirSync(tmpDir);
  expect(files).toContain('pipeline-report.json');
});

test('returns empty report for empty directory', async () => {
  const report = await generateReport(tmpDir);
  expect(report.total_transactions).toBe(0);
  expect(report.settled_count).toBe(0);
  expect(report.rejected_count).toBe(0);
});
