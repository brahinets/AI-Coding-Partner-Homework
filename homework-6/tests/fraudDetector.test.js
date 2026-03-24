'use strict';

const { processMessage } = require('../agents/fraudDetector');

function makeMessage(data) {
  return {
    message_id: 'test-msg-id',
    timestamp: '2024-01-15T10:00:00.000Z',
    source_agent: 'transaction_validator',
    target_agent: 'fraud_detector',
    message_type: 'transaction',
    data,
  };
}

function validatedData(overrides = {}) {
  return {
    transaction_id: 'TXN-001',
    amount: '1000.00',
    currency: 'USD',
    source_account: 'ACC-1234',
    destination_account: 'ACC-5678',
    timestamp: '2024-01-15T10:00:00.000Z', // 10 AM UTC — normal hour
    status: 'validated',
    ...overrides,
  };
}

describe('fraudDetector.processMessage', () => {
  describe('pass-through for already-rejected messages', () => {
    it('should forward rejected messages without scoring', () => {
      const msg = makeMessage({
        transaction_id: 'TXN-REJ',
        status: 'rejected',
        rejection_reason: 'MISSING_FIELDS',
        source_account: 'ACC-1234',
        destination_account: 'ACC-5678',
      });
      const result = processMessage(msg);

      expect(result.source_agent).toBe('fraud_detector');
      expect(result.target_agent).toBe('compliance_checker');
      expect(result.data.fraud_risk_score).toBeUndefined();
      expect(result.data.status).toBe('rejected');
    });
  });

  describe('amount scoring', () => {
    it('should assign LOW risk for amount ≤ $10,000', () => {
      const result = processMessage(makeMessage(validatedData({ amount: '5000' })));

      expect(result.data.fraud_risk_level).toBe('LOW');
      expect(result.data.fraud_risk_score).toBe(0);
    });

    it('should assign MEDIUM risk for amount $10,001–$50,000', () => {
      const result = processMessage(makeMessage(validatedData({ amount: '25000' })));

      expect(result.data.fraud_risk_level).toBe('MEDIUM');
      expect(result.data.fraud_risk_score).toBe(3);
    });

    it('should assign HIGH risk for amount > $50,000', () => {
      const result = processMessage(makeMessage(validatedData({ amount: '100000' })));

      expect(result.data.fraud_risk_level).toBe('HIGH');
      expect(result.data.fraud_risk_score).toBe(7);
    });

    it('should treat amount exactly $10,000 as LOW risk (boundary)', () => {
      const result = processMessage(makeMessage(validatedData({ amount: '10000' })));

      expect(result.data.fraud_risk_level).toBe('LOW');
      expect(result.data.fraud_risk_score).toBe(0);
    });

    it('should treat amount exactly $50,000 as MEDIUM risk (boundary)', () => {
      const result = processMessage(makeMessage(validatedData({ amount: '50000' })));

      expect(result.data.fraud_risk_level).toBe('MEDIUM');
      expect(result.data.fraud_risk_score).toBe(3);
    });
  });

  describe('unusual hour scoring', () => {
    it('should add 2 points for a transaction at 2 AM UTC', () => {
      // 2024-01-15T02:30:00.000Z → hour=2
      const result = processMessage(
        makeMessage(validatedData({ timestamp: '2024-01-15T02:30:00.000Z', amount: '100' })),
      );

      // score=2 → still LOW (threshold: ≤2 = LOW, ≤6 = MEDIUM)
      expect(result.data.fraud_risk_score).toBe(2);
      expect(result.data.fraud_risk_level).toBe('LOW');
    });

    it('should add 2 points for a transaction at 3 AM UTC', () => {
      const result = processMessage(
        makeMessage(validatedData({ timestamp: '2024-01-15T03:59:00.000Z', amount: '100' })),
      );

      expect(result.data.fraud_risk_score).toBe(2);
    });

    it('should NOT add points for a transaction at 4 AM UTC (boundary excluded)', () => {
      const result = processMessage(
        makeMessage(validatedData({ timestamp: '2024-01-15T04:00:00.000Z', amount: '100' })),
      );

      expect(result.data.fraud_risk_score).toBe(0);
    });

    it('should NOT add points for a transaction at 1 AM UTC (boundary excluded)', () => {
      const result = processMessage(
        makeMessage(validatedData({ timestamp: '2024-01-15T01:59:00.000Z', amount: '100' })),
      );

      expect(result.data.fraud_risk_score).toBe(0);
    });
  });

  describe('currency / cross-border scoring', () => {
    it('should add 1 point for non-USD currency', () => {
      const result = processMessage(makeMessage(validatedData({ currency: 'EUR', amount: '100' })));

      expect(result.data.fraud_risk_score).toBe(1);
    });

    it('should add 1 point for USD with foreign country in metadata', () => {
      const result = processMessage(
        makeMessage(
          validatedData({
            currency: 'USD',
            amount: '100',
            metadata: { country: 'DE' },
          }),
        ),
      );

      expect(result.data.fraud_risk_score).toBe(1);
    });

    it('should NOT add cross-border points for USD with US country', () => {
      const result = processMessage(
        makeMessage(
          validatedData({
            currency: 'USD',
            amount: '100',
            metadata: { country: 'US' },
          }),
        ),
      );

      expect(result.data.fraud_risk_score).toBe(0);
    });

    it('should NOT add cross-border points for USD with no metadata', () => {
      const result = processMessage(makeMessage(validatedData({ currency: 'USD', amount: '100' })));

      expect(result.data.fraud_risk_score).toBe(0);
    });

    it('should NOT add cross-border points for USD with metadata but no country field', () => {
      const result = processMessage(
        makeMessage(validatedData({ currency: 'USD', amount: '100', metadata: {} })),
      );

      expect(result.data.fraud_risk_score).toBe(0);
    });
  });

  describe('known fraud accounts', () => {
    it('should add 2 points when source_account is a known fraud account', () => {
      const result = processMessage(
        makeMessage(validatedData({ source_account: 'ACC-9999', amount: '100' })),
      );

      expect(result.data.fraud_risk_score).toBe(2);
    });

    it('should add 2 points when destination_account is a known fraud account', () => {
      const result = processMessage(
        makeMessage(validatedData({ destination_account: 'ACC-0000', amount: '100' })),
      );

      expect(result.data.fraud_risk_score).toBe(2);
    });

    it('should add 2 points for ACC-1111 fraud account', () => {
      const result = processMessage(
        makeMessage(validatedData({ source_account: 'ACC-1111', amount: '100' })),
      );

      expect(result.data.fraud_risk_score).toBe(2);
    });

    it('should not double-count when both accounts are in the fraud list', () => {
      // The check is a single OR — only +2 regardless of how many fraud accounts match
      const result = processMessage(
        makeMessage(
          validatedData({ source_account: 'ACC-9999', destination_account: 'ACC-0000', amount: '100' }),
        ),
      );

      expect(result.data.fraud_risk_score).toBe(2);
    });
  });

  describe('score combination and risk level boundaries', () => {
    it('should return MEDIUM risk for score exactly 3 (amount $25k)', () => {
      const result = processMessage(makeMessage(validatedData({ amount: '25000' })));
      expect(result.data.fraud_risk_level).toBe('MEDIUM');
    });

    it('should return MEDIUM risk for score exactly 6 (amount $25k + unusual hour + non-USD)', () => {
      const result = processMessage(
        makeMessage(
          validatedData({
            amount: '25000',
            currency: 'EUR',
            timestamp: '2024-01-15T02:30:00.000Z',
          }),
        ),
      );
      // score: 3 (amount) + 2 (hour) + 1 (non-USD) = 6 → MEDIUM
      expect(result.data.fraud_risk_score).toBe(6);
      expect(result.data.fraud_risk_level).toBe('MEDIUM');
    });

    it('should return HIGH risk for score > 6', () => {
      // score: 7 (amount >50k)
      const result = processMessage(makeMessage(validatedData({ amount: '100000' })));
      expect(result.data.fraud_risk_level).toBe('HIGH');
    });

    it('should set target_agent to compliance_checker', () => {
      const result = processMessage(makeMessage(validatedData({ amount: '100' })));
      expect(result.target_agent).toBe('compliance_checker');
      expect(result.source_agent).toBe('fraud_detector');
    });
  });

  describe('maskAccount edge cases via audit log', () => {
    it('should handle short account names without throwing', () => {
      const result = processMessage(
        makeMessage(validatedData({ source_account: 'AB', destination_account: 'X', amount: '100' })),
      );
      expect(result.data.fraud_risk_score).toBeDefined();
    });
  });
});