'use strict';

// uuid v13 ships ESM-only dist; mock it so Jest (CJS mode) can require settlementProcessor
jest.mock('uuid', () => {
  let counter = 0;
  return { v4: () => `mock-uuid-${++counter}` };
});

const fs = require('fs');
const os = require('os');
const path = require('path');

let _msgCounter = 0;
function testId() { return `test-msg-${++_msgCounter}`; }

const transactionValidator = require('../agents/transactionValidator');
const fraudDetector = require('../agents/fraudDetector');
const complianceChecker = require('../agents/complianceChecker');
const settlementProcessor = require('../agents/settlementProcessor');
const { generateReport } = require('../agents/reportingAgent');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-integration-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/**
 * Run a single transaction through the full 5-agent pipeline.
 * Returns { validatorOut, fraudOut, complianceOut, settlementOut }.
 */
async function runPipeline(txnData) {
  const initialMessage = {
    message_id: testId(),
    timestamp: new Date().toISOString(),
    source_agent: 'test_harness',
    target_agent: 'transaction_validator',
    message_type: 'transaction',
    data: txnData,
  };

  const validatorOut = transactionValidator.processMessage(initialMessage);
  const fraudOut = fraudDetector.processMessage(validatorOut);
  const complianceOut = complianceChecker.processMessage(fraudOut);
  const settlementOut = await settlementProcessor.processMessage(complianceOut, tmpDir);

  return { validatorOut, fraudOut, complianceOut, settlementOut };
}

describe('Pipeline integration', () => {
  describe('Happy path: valid low-risk USD transaction', () => {
    it('should be validated → scored LOW → cleared → settled', async () => {
      const { validatorOut, fraudOut, complianceOut, settlementOut } = await runPipeline({
        transaction_id: 'TXN-HAPPY',
        amount: '500.00',
        currency: 'USD',
        source_account: 'ACC-ALICE',
        destination_account: 'ACC-BOB',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'credit',
      });

      expect(validatorOut.data.status).toBe('validated');
      expect(fraudOut.data.fraud_risk_level).toBe('LOW');
      expect(complianceOut.data.compliance_status).toBe('cleared');
      expect(settlementOut.data.status).toBe('settled');
      expect(settlementOut.data.review_flag).toBeUndefined();
      expect(settlementOut.data.settlement_id).toBeDefined();

      // Result file must exist
      expect(fs.existsSync(path.join(tmpDir, 'TXN-HAPPY.json'))).toBe(true);
    });
  });

  describe('Invalid currency transaction', () => {
    it('should be rejected at validation and pass through remaining agents unchanged', async () => {
      const { validatorOut, fraudOut, complianceOut, settlementOut } = await runPipeline({
        transaction_id: 'TXN-BAD-CURR',
        amount: '200.00',
        currency: 'ZZZ',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'credit',
      });

      expect(validatorOut.data.status).toBe('rejected');
      expect(validatorOut.data.rejection_reason).toBe('INVALID_CURRENCY');

      // Fraud detector and compliance checker must pass through
      expect(fraudOut.data.status).toBe('rejected');
      expect(fraudOut.data.fraud_risk_score).toBeUndefined();

      expect(complianceOut.data.status).toBe('rejected');
      expect(complianceOut.data.compliance_status).toBeUndefined();

      // Settlement processor writes the rejection result
      expect(settlementOut.data.status).toBe('rejected');
      expect(settlementOut.data.rejection_reason).toBe('INVALID_CURRENCY');

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'TXN-BAD-CURR.json'), 'utf8'));
      expect(written.status).toBe('rejected');
    });
  });

  describe('High-fraud amount transaction', () => {
    it('should be validated → scored HIGH → cleared → rejected by settlement', async () => {
      const { validatorOut, fraudOut, complianceOut, settlementOut } = await runPipeline({
        transaction_id: 'TXN-HIGH',
        amount: '75000.00',
        currency: 'USD',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'wire_transfer',
      });

      expect(validatorOut.data.status).toBe('validated');
      expect(fraudOut.data.fraud_risk_level).toBe('HIGH');
      expect(complianceOut.data.compliance_status).toBe('cleared');
      expect(complianceOut.data.compliance_flag).toBe('AML_REVIEW_REQUIRED');

      expect(settlementOut.data.status).toBe('rejected');
      expect(settlementOut.data.rejection_reason).toBe('FRAUD_RISK_HIGH');
    });
  });

  describe('Sanctioned account transaction', () => {
    it('should be validated, scored, then rejected at compliance for sanctioned account', async () => {
      const { validatorOut, fraudOut, complianceOut, settlementOut } = await runPipeline({
        transaction_id: 'TXN-SANC',
        amount: '1000.00',
        currency: 'USD',
        source_account: 'ACC-SANC1',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'credit',
      });

      expect(validatorOut.data.status).toBe('validated');
      expect(fraudOut.data.fraud_risk_level).toBeDefined();

      expect(complianceOut.data.status).toBe('rejected');
      expect(complianceOut.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');

      expect(settlementOut.data.status).toBe('rejected');
      expect(settlementOut.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');
    });
  });

  describe('Medium-risk transaction with AML flag', () => {
    it('should settle with review_flag and AML flag for large wire_transfer', async () => {
      const { fraudOut, complianceOut, settlementOut } = await runPipeline({
        transaction_id: 'TXN-MEDIUM-AML',
        amount: '25000.00',
        currency: 'USD',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'wire_transfer',
      });

      expect(fraudOut.data.fraud_risk_level).toBe('MEDIUM');
      expect(complianceOut.data.compliance_flag).toBe('AML_REVIEW_REQUIRED');
      expect(settlementOut.data.status).toBe('settled');
      expect(settlementOut.data.review_flag).toBe(true);
    });
  });

  describe('Full pipeline with reporting', () => {
    it('should generate a correct report after processing multiple transactions', async () => {
      // Valid low-risk
      await runPipeline({
        transaction_id: 'TXN-REPORT-1',
        amount: '500.00',
        currency: 'USD',
        source_account: 'ACC-ALICE',
        destination_account: 'ACC-BOB',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'credit',
      });

      // Invalid currency → rejected early
      await runPipeline({
        transaction_id: 'TXN-REPORT-2',
        amount: '200.00',
        currency: 'XYZ',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'credit',
      });

      // High fraud → rejected by settlement
      await runPipeline({
        transaction_id: 'TXN-REPORT-3',
        amount: '75000.00',
        currency: 'USD',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
        transaction_type: 'wire_transfer',
      });

      const report = await generateReport(tmpDir);

      expect(report.total_transactions).toBe(3);
      expect(report.settled_count).toBe(1);
      expect(report.rejected_count).toBe(2);

      expect(report.by_risk_level.LOW).toBeGreaterThanOrEqual(1);
      expect(report.by_risk_level.HIGH).toBeGreaterThanOrEqual(1);

      expect(report.rejection_reasons['INVALID_CURRENCY']).toBe(1);
      expect(report.rejection_reasons['FRAUD_RISK_HIGH']).toBe(1);

      // pipeline-report.json written
      expect(fs.existsSync(path.join(tmpDir, 'pipeline-report.json'))).toBe(true);
    });
  });

  describe('Missing required fields transaction', () => {
    it('should be rejected immediately at validation for missing fields', async () => {
      const { validatorOut, settlementOut } = await runPipeline({
        // missing transaction_id, currency
        amount: '100.00',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
      });

      expect(validatorOut.data.status).toBe('rejected');
      expect(validatorOut.data.rejection_reason).toBe('MISSING_FIELDS');
      expect(settlementOut.data.status).toBe('rejected');
    });
  });
});
