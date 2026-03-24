'use strict';

// uuid v13 ships ESM-only dist; mock it so Jest (CJS mode) can require settlementProcessor
jest.mock('uuid', () => ({ v4: () => 'test-settlement-uuid' }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { processMessage } = require('../agents/settlementProcessor');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settlement-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeMessage(data) {
  return {
    message_id: 'test-msg-id',
    timestamp: '2024-01-15T10:00:00.000Z',
    source_agent: 'compliance_checker',
    target_agent: 'settlement_processor',
    message_type: 'transaction',
    data,
  };
}

function compliancePassedData(overrides = {}) {
  return {
    transaction_id: 'TXN-001',
    amount: '1000.00',
    currency: 'USD',
    source_account: 'ACC-1234',
    destination_account: 'ACC-5678',
    timestamp: '2024-01-15T10:00:00.000Z',
    status: 'validated',
    fraud_risk_score: 0,
    fraud_risk_level: 'LOW',
    compliance_status: 'cleared',
    ...overrides,
  };
}

describe('settlementProcessor.processMessage', () => {
  describe('already-rejected pass-through', () => {
    it('should write result file and forward rejected messages without changing status', async () => {
      const data = {
        transaction_id: 'TXN-REJ',
        status: 'rejected',
        rejection_reason: 'MISSING_FIELDS',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        amount: '100',
      };
      const result = await processMessage(makeMessage(data), tmpDir);

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
      expect(result.source_agent).toBe('settlement_processor');
      expect(result.target_agent).toBe('reporting_agent');

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'TXN-REJ.json'), 'utf8'));
      expect(written.status).toBe('rejected');
    });
  });

  describe('HIGH fraud risk rejection', () => {
    it('should reject transactions with HIGH fraud risk', async () => {
      const result = await processMessage(
        makeMessage(compliancePassedData({ fraud_risk_level: 'HIGH', amount: '100000' })),
        tmpDir,
      );

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('FRAUD_RISK_HIGH');
      expect(result.source_agent).toBe('settlement_processor');
      expect(result.target_agent).toBe('reporting_agent');
    });

    it('should write the result file for HIGH fraud rejection', async () => {
      await processMessage(
        makeMessage(compliancePassedData({ transaction_id: 'TXN-HIGH', fraud_risk_level: 'HIGH', amount: '100000' })),
        tmpDir,
      );

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'TXN-HIGH.json'), 'utf8'));
      expect(written.status).toBe('rejected');
      expect(written.rejection_reason).toBe('FRAUD_RISK_HIGH');
    });
  });

  describe('MEDIUM fraud risk settlement', () => {
    it('should settle transactions with MEDIUM fraud risk', async () => {
      const result = await processMessage(
        makeMessage(compliancePassedData({ fraud_risk_level: 'MEDIUM', amount: '25000' })),
        tmpDir,
      );

      expect(result.data.status).toBe('settled');
      expect(result.data.review_flag).toBe(true);
      expect(result.data.settlement_id).toBeDefined();
      expect(result.data.settlement_timestamp).toBeDefined();
    });

    it('should write the result file with review_flag=true for MEDIUM risk', async () => {
      await processMessage(
        makeMessage(compliancePassedData({ transaction_id: 'TXN-MED', fraud_risk_level: 'MEDIUM', amount: '25000' })),
        tmpDir,
      );

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'TXN-MED.json'), 'utf8'));
      expect(written.status).toBe('settled');
      expect(written.review_flag).toBe(true);
      expect(written.settlement_id).toBeDefined();
    });
  });

  describe('LOW fraud risk settlement', () => {
    it('should settle transactions with LOW fraud risk', async () => {
      const result = await processMessage(
        makeMessage(compliancePassedData({ fraud_risk_level: 'LOW', amount: '500' })),
        tmpDir,
      );

      expect(result.data.status).toBe('settled');
      expect(result.data.review_flag).toBeUndefined();
      expect(result.data.settlement_id).toBeDefined();
      expect(result.data.settlement_timestamp).toBeDefined();
    });

    it('should write the result file with no review_flag for LOW risk', async () => {
      await processMessage(
        makeMessage(compliancePassedData({ transaction_id: 'TXN-LOW', fraud_risk_level: 'LOW', amount: '500' })),
        tmpDir,
      );

      const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'TXN-LOW.json'), 'utf8'));
      expect(written.status).toBe('settled');
      expect(written.review_flag).toBeUndefined();
    });
  });

  describe('result file writing', () => {
    it('should write a JSON file named <transaction_id>.json in resultsDir', async () => {
      await processMessage(
        makeMessage(compliancePassedData({ transaction_id: 'TXN-FILE-TEST' })),
        tmpDir,
      );

      const expectedPath = path.join(tmpDir, 'TXN-FILE-TEST.json');
      expect(fs.existsSync(expectedPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
      expect(content.transaction_id).toBe('TXN-FILE-TEST');
    });

    it('should use UNKNOWN as filename when transaction_id is missing', async () => {
      const data = {
        amount: '500',
        currency: 'USD',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        timestamp: '2024-01-15T10:00:00.000Z',
        status: 'validated',
        fraud_risk_score: 0,
        fraud_risk_level: 'LOW',
        compliance_status: 'cleared',
      };
      await processMessage(makeMessage(data), tmpDir);

      const expectedPath = path.join(tmpDir, 'UNKNOWN.json');
      expect(fs.existsSync(expectedPath)).toBe(true);
    });
  });

  describe('maskAccount edge cases via audit log', () => {
    it('should handle short source account names (< 4 chars) without throwing', async () => {
      const result = await processMessage(
        makeMessage(compliancePassedData({
          transaction_id: 'TXN-SHORT',
          source_account: 'AB',
          destination_account: 'X',
          fraud_risk_level: 'LOW',
        })),
        tmpDir,
      );
      expect(result.data.status).toBe('settled');
    });

    it('should handle null/undefined account gracefully', async () => {
      const result = await processMessage(
        makeMessage(compliancePassedData({
          transaction_id: 'TXN-NULL-ACC',
          source_account: null,
          destination_account: undefined,
          fraud_risk_level: 'LOW',
        })),
        tmpDir,
      );
      expect(result.data.status).toBe('settled');
    });
  });

  describe('message structure', () => {
    it('should set source_agent to settlement_processor', async () => {
      const result = await processMessage(makeMessage(compliancePassedData()), tmpDir);
      expect(result.source_agent).toBe('settlement_processor');
    });

    it('should set target_agent to reporting_agent', async () => {
      const result = await processMessage(makeMessage(compliancePassedData()), tmpDir);
      expect(result.target_agent).toBe('reporting_agent');
    });

    it('should preserve original message fields', async () => {
      const msg = makeMessage(compliancePassedData());
      const result = await processMessage(msg, tmpDir);

      expect(result.message_id).toBe('test-msg-id');
      expect(result.message_type).toBe('transaction');
    });
  });
});