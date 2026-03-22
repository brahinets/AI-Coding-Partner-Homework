'use strict';

const { processMessage } = require('../agents/complianceChecker');

function makeMessage(data) {
  return {
    message_id: 'test-msg-id',
    timestamp: '2024-01-15T10:00:00.000Z',
    source_agent: 'fraud_detector',
    target_agent: 'compliance_checker',
    message_type: 'transaction',
    data,
  };
}

function scoredData(overrides = {}) {
  return {
    transaction_id: 'TXN-001',
    amount: '1000.00',
    currency: 'USD',
    source_account: 'ACC-1234',
    destination_account: 'ACC-5678',
    timestamp: '2024-01-15T10:00:00.000Z',
    transaction_type: 'credit',
    status: 'validated',
    fraud_risk_score: 0,
    fraud_risk_level: 'LOW',
    ...overrides,
  };
}

describe('complianceChecker.processMessage', () => {
  describe('pass-through for already-rejected messages', () => {
    it('should forward rejected messages unchanged', () => {
      const msg = makeMessage({
        transaction_id: 'TXN-REJ',
        status: 'rejected',
        rejection_reason: 'MISSING_FIELDS',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
        amount: '100',
      });
      const result = processMessage(msg);

      expect(result.source_agent).toBe('compliance_checker');
      expect(result.target_agent).toBe('settlement_processor');
      expect(result.data.status).toBe('rejected');
      expect(result.data.compliance_status).toBeUndefined();
    });
  });

  describe('sanctioned account checks', () => {
    it('should reject when source_account is ACC-SANC1', () => {
      const result = processMessage(makeMessage(scoredData({ source_account: 'ACC-SANC1' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');
      expect(result.target_agent).toBe('settlement_processor');
    });

    it('should reject when source_account is ACC-SANC2', () => {
      const result = processMessage(makeMessage(scoredData({ source_account: 'ACC-SANC2' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');
    });

    it('should reject when destination_account is ACC-SANC1', () => {
      const result = processMessage(makeMessage(scoredData({ destination_account: 'ACC-SANC1' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');
    });

    it('should reject when destination_account is ACC-SANC2', () => {
      const result = processMessage(makeMessage(scoredData({ destination_account: 'ACC-SANC2' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('SANCTIONED_ACCOUNT');
    });
  });

  describe('AML wire_transfer checks', () => {
    it('should set AML_REVIEW_REQUIRED for wire_transfer > $10,000', () => {
      const result = processMessage(
        makeMessage(scoredData({ transaction_type: 'wire_transfer', amount: '15000' })),
      );

      expect(result.data.compliance_flag).toBe('AML_REVIEW_REQUIRED');
      expect(result.data.compliance_status).toBe('cleared');
      expect(result.data.status).toBe('validated');
    });

    it('should NOT flag AML for wire_transfer exactly $10,000 (boundary)', () => {
      const result = processMessage(
        makeMessage(scoredData({ transaction_type: 'wire_transfer', amount: '10000' })),
      );

      expect(result.data.compliance_flag).toBeUndefined();
      expect(result.data.compliance_status).toBe('cleared');
    });

    it('should NOT flag AML for wire_transfer below $10,000', () => {
      const result = processMessage(
        makeMessage(scoredData({ transaction_type: 'wire_transfer', amount: '9999' })),
      );

      expect(result.data.compliance_flag).toBeUndefined();
      expect(result.data.compliance_status).toBe('cleared');
    });

    it('should NOT flag AML for a non-wire_transfer transaction even above $10,000', () => {
      const result = processMessage(
        makeMessage(scoredData({ transaction_type: 'credit', amount: '50000' })),
      );

      expect(result.data.compliance_flag).toBeUndefined();
      expect(result.data.compliance_status).toBe('cleared');
    });

    it('should NOT flag AML for a debit transaction above $10,000', () => {
      const result = processMessage(
        makeMessage(scoredData({ transaction_type: 'debit', amount: '20000' })),
      );

      expect(result.data.compliance_flag).toBeUndefined();
      expect(result.data.compliance_status).toBe('cleared');
    });
  });

  describe('cleared transactions', () => {
    it('should set compliance_status cleared for a normal transaction', () => {
      const result = processMessage(makeMessage(scoredData()));

      expect(result.data.compliance_status).toBe('cleared');
      expect(result.data.status).toBe('validated');
      expect(result.source_agent).toBe('compliance_checker');
      expect(result.target_agent).toBe('settlement_processor');
    });

    it('should preserve fraud_risk_level in the output data', () => {
      const result = processMessage(makeMessage(scoredData({ fraud_risk_level: 'MEDIUM' })));

      expect(result.data.fraud_risk_level).toBe('MEDIUM');
      expect(result.data.compliance_status).toBe('cleared');
    });
  });

  describe('maskAccount edge cases via audit log', () => {
    it('should handle short account names without throwing', () => {
      const result = processMessage(
        makeMessage(scoredData({ source_account: 'AB', destination_account: 'C' })),
      );
      expect(result.data.compliance_status).toBe('cleared');
    });
  });
});