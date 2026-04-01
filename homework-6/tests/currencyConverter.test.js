'use strict';

const { processMessage } = require('../agents/currencyConverter');

function makeMessage(data) {
  return {
    message_id: 'test-msg-id',
    timestamp: '2024-01-15T10:00:00.000Z',
    source_agent: 'test',
    target_agent: 'currency_converter',
    message_type: 'transaction',
    data,
  };
}

function validData(overrides = {}) {
  return {
    transaction_id: 'TXN-001',
    amount: '100.00',
    currency: 'USD',
    source_account: 'ACC-1234',
    destination_account: 'ACC-5678',
    timestamp: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('currencyConverter.processMessage', () => {
  describe('pass-through: already rejected', () => {
    it('should pass through messages already rejected without modification', () => {
      const msg = makeMessage(validData({ status: 'rejected', rejection_reason: 'MISSING_FIELDS' }));
      const result = processMessage(msg);

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
      expect(result.source_agent).toBe('currency_converter');
      expect(result.target_agent).toBe('transaction_validator');
    });

    it('should preserve all original data fields when passing through rejected messages', () => {
      const msg = makeMessage(validData({ status: 'rejected' }));
      const result = processMessage(msg);

      expect(result.message_id).toBe('test-msg-id');
      expect(result.message_type).toBe('transaction');
    });
  });

  describe('pass-through: unsupported currency', () => {
    it('should pass through messages with unsupported currency without conversion', () => {
      const msg = makeMessage(validData({ currency: 'GBP', amount: '200.00' }));
      const result = processMessage(msg);

      expect(result.data.currency).toBe('GBP');
      expect(result.data.amount).toBe('200.00');
      expect(result.source_agent).toBe('currency_converter');
    });

    it('should pass through unknown currency codes', () => {
      const msg = makeMessage(validData({ currency: 'XYZ', amount: '50.00' }));
      const result = processMessage(msg);

      expect(result.data.currency).toBe('XYZ');
      expect(result.data.amount).toBe('50.00');
    });
  });

  describe('pass-through: USD (no conversion needed)', () => {
    it('should pass through USD transactions without changing amount or currency', () => {
      const msg = makeMessage(validData({ currency: 'USD', amount: '500.00' }));
      const result = processMessage(msg);

      expect(result.data.currency).toBe('USD');
      expect(result.data.amount).toBe('500.00');
      expect(result.data.original_amount).toBeUndefined();
      expect(result.data.conversion_rate).toBeUndefined();
    });
  });

  describe('currency conversion', () => {
    it('should convert EUR to USD at rate 1.08', () => {
      const msg = makeMessage(validData({ currency: 'EUR', amount: '100.00' }));
      const result = processMessage(msg);

      expect(result.data.currency).toBe('USD');
      expect(result.data.amount).toBe('108.00');
      expect(result.data.original_amount).toBe('100.00');
      expect(result.data.original_currency).toBe('EUR');
      expect(result.data.conversion_rate).toBe('1.0800');
    });

    it('should convert UAH to USD at rate 0.024', () => {
      const msg = makeMessage(validData({ currency: 'UAH', amount: '1000.00' }));
      const result = processMessage(msg);

      expect(result.data.currency).toBe('USD');
      expect(result.data.amount).toBe('24.00');
      expect(result.data.original_amount).toBe('1000.00');
      expect(result.data.original_currency).toBe('UAH');
      expect(result.data.conversion_rate).toBe('0.0240');
    });

    it('should round converted amount to 2 decimal places', () => {
      // 1 UAH * 0.024 = 0.024 → rounded to 0.02
      const msg = makeMessage(validData({ currency: 'UAH', amount: '1' }));
      const result = processMessage(msg);

      expect(result.data.amount).toBe('0.02');
    });

    it('should preserve all non-amount fields when converting', () => {
      const msg = makeMessage(validData({ currency: 'EUR', amount: '100.00' }));
      const result = processMessage(msg);

      expect(result.data.transaction_id).toBe('TXN-001');
      expect(result.data.source_account).toBe('ACC-1234');
      expect(result.data.destination_account).toBe('ACC-5678');
      expect(result.source_agent).toBe('currency_converter');
      expect(result.target_agent).toBe('transaction_validator');
    });

    it('should preserve message envelope fields after conversion', () => {
      const msg = makeMessage(validData({ currency: 'EUR', amount: '50.00' }));
      const result = processMessage(msg);

      expect(result.message_id).toBe('test-msg-id');
      expect(result.message_type).toBe('transaction');
    });
  });

  describe('transaction_id fallback', () => {
    it('should handle missing transaction_id without throwing', () => {
      const data = validData({ currency: 'EUR', amount: '100.00' });
      delete data.transaction_id;
      const msg = makeMessage(data);
      const result = processMessage(msg);

      expect(result.data.currency).toBe('USD');
      expect(result.data.amount).toBe('108.00');
    });
  });
});
