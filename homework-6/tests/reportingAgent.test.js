'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateReport } = require('../agents/reportingAgent');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporting-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTxnFile(dir, txnId, data) {
  fs.writeFileSync(path.join(dir, `${txnId}.json`), JSON.stringify(data, null, 2), 'utf8');
}

describe('reportingAgent.generateReport', () => {
  describe('empty results directory', () => {
    it('should generate a report with zero counts for an empty directory', async () => {
      const report = await generateReport(tmpDir);

      expect(report.total_transactions).toBe(0);
      expect(report.settled_count).toBe(0);
      expect(report.rejected_count).toBe(0);
      expect(report.by_risk_level).toEqual({ LOW: 0, MEDIUM: 0, HIGH: 0, 'N/A': 0 });
      expect(report.rejection_reasons).toEqual({});
      expect(report.aml_review_required).toEqual([]);
    });

    it('should write pipeline-report.json to resultsDir', async () => {
      await generateReport(tmpDir);
      expect(fs.existsSync(path.join(tmpDir, 'pipeline-report.json'))).toBe(true);
    });
  });

  describe('settled transactions', () => {
    it('should count settled transactions correctly', async () => {
      writeTxnFile(tmpDir, 'TXN-001', {
        transaction_id: 'TXN-001',
        status: 'settled',
        fraud_risk_level: 'LOW',
      });
      writeTxnFile(tmpDir, 'TXN-002', {
        transaction_id: 'TXN-002',
        status: 'settled',
        fraud_risk_level: 'MEDIUM',
        review_flag: true,
      });

      const report = await generateReport(tmpDir);

      expect(report.total_transactions).toBe(2);
      expect(report.settled_count).toBe(2);
      expect(report.rejected_count).toBe(0);
      expect(report.by_risk_level.LOW).toBe(1);
      expect(report.by_risk_level.MEDIUM).toBe(1);
    });
  });

  describe('rejected transactions', () => {
    it('should count rejected transactions and track rejection reasons', async () => {
      writeTxnFile(tmpDir, 'TXN-R1', {
        transaction_id: 'TXN-R1',
        status: 'rejected',
        rejection_reason: 'FRAUD_RISK_HIGH',
        fraud_risk_level: 'HIGH',
      });
      writeTxnFile(tmpDir, 'TXN-R2', {
        transaction_id: 'TXN-R2',
        status: 'rejected',
        rejection_reason: 'MISSING_FIELDS',
      });
      writeTxnFile(tmpDir, 'TXN-R3', {
        transaction_id: 'TXN-R3',
        status: 'rejected',
        rejection_reason: 'FRAUD_RISK_HIGH',
        fraud_risk_level: 'HIGH',
      });

      const report = await generateReport(tmpDir);

      expect(report.rejected_count).toBe(3);
      expect(report.settled_count).toBe(0);
      expect(report.rejection_reasons['FRAUD_RISK_HIGH']).toBe(2);
      expect(report.rejection_reasons['MISSING_FIELDS']).toBe(1);
    });
  });

  describe('by_risk_level tallying', () => {
    it('should tally all risk levels correctly across mixed transactions', async () => {
      writeTxnFile(tmpDir, 'TXN-L', { transaction_id: 'TXN-L', status: 'settled', fraud_risk_level: 'LOW' });
      writeTxnFile(tmpDir, 'TXN-M', { transaction_id: 'TXN-M', status: 'settled', fraud_risk_level: 'MEDIUM' });
      writeTxnFile(tmpDir, 'TXN-H', { transaction_id: 'TXN-H', status: 'rejected', fraud_risk_level: 'HIGH', rejection_reason: 'FRAUD_RISK_HIGH' });

      const report = await generateReport(tmpDir);

      expect(report.by_risk_level.LOW).toBe(1);
      expect(report.by_risk_level.MEDIUM).toBe(1);
      expect(report.by_risk_level.HIGH).toBe(1);
      expect(report.by_risk_level['N/A']).toBe(0);
    });

    it('should use N/A for transactions with no fraud_risk_level', async () => {
      writeTxnFile(tmpDir, 'TXN-NA', {
        transaction_id: 'TXN-NA',
        status: 'rejected',
        rejection_reason: 'MISSING_FIELDS',
        // no fraud_risk_level — pre-validation rejection
      });

      const report = await generateReport(tmpDir);

      expect(report.by_risk_level['N/A']).toBe(1);
    });

    it('should add a new key for an unknown risk level not in the template', async () => {
      writeTxnFile(tmpDir, 'TXN-UNK', {
        transaction_id: 'TXN-UNK',
        status: 'settled',
        fraud_risk_level: 'UNKNOWN_LEVEL',
      });

      const report = await generateReport(tmpDir);

      expect(report.by_risk_level['UNKNOWN_LEVEL']).toBe(1);
    });
  });

  describe('AML review required list', () => {
    it('should include transaction_id in aml_review_required when compliance_flag is set', async () => {
      writeTxnFile(tmpDir, 'TXN-AML', {
        transaction_id: 'TXN-AML',
        status: 'settled',
        fraud_risk_level: 'LOW',
        compliance_flag: 'AML_REVIEW_REQUIRED',
      });

      const report = await generateReport(tmpDir);

      expect(report.aml_review_required).toContain('TXN-AML');
    });

    it('should not include transactions without compliance_flag in aml_review_required', async () => {
      writeTxnFile(tmpDir, 'TXN-CLEAN', {
        transaction_id: 'TXN-CLEAN',
        status: 'settled',
        fraud_risk_level: 'LOW',
      });

      const report = await generateReport(tmpDir);

      expect(report.aml_review_required).toHaveLength(0);
    });

    it('should collect multiple AML transactions', async () => {
      writeTxnFile(tmpDir, 'TXN-AML1', {
        transaction_id: 'TXN-AML1',
        status: 'settled',
        fraud_risk_level: 'LOW',
        compliance_flag: 'AML_REVIEW_REQUIRED',
      });
      writeTxnFile(tmpDir, 'TXN-AML2', {
        transaction_id: 'TXN-AML2',
        status: 'settled',
        fraud_risk_level: 'MEDIUM',
        compliance_flag: 'AML_REVIEW_REQUIRED',
      });

      const report = await generateReport(tmpDir);

      expect(report.aml_review_required).toHaveLength(2);
      expect(report.aml_review_required).toContain('TXN-AML1');
      expect(report.aml_review_required).toContain('TXN-AML2');
    });
  });

  describe('report file content', () => {
    it('should write a valid JSON report file to the results directory', async () => {
      writeTxnFile(tmpDir, 'TXN-001', {
        transaction_id: 'TXN-001',
        status: 'settled',
        fraud_risk_level: 'LOW',
      });

      await generateReport(tmpDir);

      const reportPath = path.join(tmpDir, 'pipeline-report.json');
      const written = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

      expect(written.total_transactions).toBe(1);
      expect(written.settled_count).toBe(1);
      expect(written.generated_at).toBeDefined();
    });

    it('should ignore pipeline-report.json when scanning for transaction files', async () => {
      writeTxnFile(tmpDir, 'TXN-001', {
        transaction_id: 'TXN-001',
        status: 'settled',
        fraud_risk_level: 'LOW',
      });

      // First run creates pipeline-report.json
      await generateReport(tmpDir);
      // Second run should not double-count
      const report = await generateReport(tmpDir);

      expect(report.total_transactions).toBe(1);
    });
  });

  describe('report return value', () => {
    it('should return the report object from generateReport', async () => {
      const report = await generateReport(tmpDir);

      expect(report).toBeDefined();
      expect(typeof report.total_transactions).toBe('number');
      expect(typeof report.generated_at).toBe('string');
    });
  });
});
