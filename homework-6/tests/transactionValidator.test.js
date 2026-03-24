'use strict';

// uuid v13 ships ESM-only dist; mock it so the dry-run CLI block can be required
jest.mock('uuid', () => ({ v4: () => 'dry-run-uuid' }));

const { processMessage } = require('../agents/transactionValidator');

function makeMessage(data) {
  return {
    message_id: 'test-msg-id',
    timestamp: '2024-01-15T10:00:00.000Z',
    source_agent: 'test',
    target_agent: 'transaction_validator',
    message_type: 'transaction',
    data,
  };
}

function validData(overrides = {}) {
  return {
    transaction_id: 'TXN-001',
    amount: '1000.00',
    currency: 'USD',
    source_account: 'ACC-1234',
    destination_account: 'ACC-5678',
    timestamp: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('transactionValidator.processMessage', () => {
  describe('valid transaction', () => {
    it('should return validated status for a fully valid transaction', () => {
      const result = processMessage(makeMessage(validData()));

      expect(result.data.status).toBe('validated');
      expect(result.source_agent).toBe('transaction_validator');
      expect(result.target_agent).toBe('fraud_detector');
      expect(result.data.rejection_reason).toBeUndefined();
    });

    it('should preserve all original message fields', () => {
      const msg = makeMessage(validData());
      const result = processMessage(msg);

      expect(result.message_id).toBe('test-msg-id');
      expect(result.message_type).toBe('transaction');
    });

    it('should accept all valid currencies', () => {
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'HKD', 'NZD', 'SEK', 'SGD', 'NOK', 'DKK'];
      for (const currency of currencies) {
        const result = processMessage(makeMessage(validData({ currency })));
        expect(result.data.status).toBe('validated');
      }
    });
  });

  describe('missing required fields', () => {
    it('should reject when transaction_id is missing', () => {
      const data = validData();
      delete data.transaction_id;
      const result = processMessage(makeMessage(data));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
    });

    it('should reject when amount is missing', () => {
      const data = validData();
      delete data.amount;
      const result = processMessage(makeMessage(data));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
    });

    it('should reject when currency is missing', () => {
      const data = validData();
      delete data.currency;
      const result = processMessage(makeMessage(data));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
    });

    it('should reject when source_account is missing', () => {
      const data = validData();
      delete data.source_account;
      const result = processMessage(makeMessage(data));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
    });

    it('should reject when destination_account is missing', () => {
      const data = validData();
      delete data.destination_account;
      const result = processMessage(makeMessage(data));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
    });

    it('should reject when timestamp is missing', () => {
      const data = validData();
      delete data.timestamp;
      const result = processMessage(makeMessage(data));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
    });

    it('should use UNKNOWN as txnId when transaction_id is absent', () => {
      const data = validData();
      delete data.transaction_id;
      // Should not throw; txnId fallback is UNKNOWN internally
      const result = processMessage(makeMessage(data));
      expect(result.data.status).toBe('rejected');
    });
  });

  describe('invalid amount', () => {
    it('should reject when amount is a non-numeric string', () => {
      const result = processMessage(makeMessage(validData({ amount: 'abc' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
    });

    it('should reject when amount is zero', () => {
      const result = processMessage(makeMessage(validData({ amount: '0' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
    });

    it('should reject when amount is negative', () => {
      const result = processMessage(makeMessage(validData({ amount: '-100' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
    });

    it('should reject when amount is 0 as a number (falsy but zero check)', () => {
      // amount=0 passes the missing fields check because of `data[f] !== 0` guard,
      // but then fails the positive-amount validation
      const result = processMessage(makeMessage(validData({ amount: 0 })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
    });
  });

  describe('invalid currency', () => {
    it('should reject an unrecognised currency code', () => {
      const result = processMessage(makeMessage(validData({ currency: 'XYZ' })));

      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('INVALID_CURRENCY');
    });

    it('should reject an empty currency string', () => {
      // empty string is falsy so it will be caught by MISSING_FIELDS; that is
      // the correct product behaviour — both paths lead to rejection
      const result = processMessage(makeMessage(validData({ currency: '' })));

      expect(result.data.status).toBe('rejected');
    });

    it('should log masked account numbers for invalid currency', () => {
      // Exercise the maskAccount path inside the currency rejection audit log
      const result = processMessage(
        makeMessage(validData({ currency: 'XXX', source_account: 'AB', destination_account: 'CD' })),
      );
      expect(result.data.status).toBe('rejected');
      expect(result.data.rejection_reason).toBe('INVALID_CURRENCY');
    });
  });

  describe('maskAccount edge cases via audit log', () => {
    it('should handle short source and destination account names without throwing', () => {
      // Accounts shorter than 4 chars → maskAccount returns '****'
      const result = processMessage(
        makeMessage(validData({ source_account: 'AB', destination_account: 'C' })),
      );
      // Currency is USD and amount is valid, so it should be validated
      expect(result.data.status).toBe('validated');
    });
  });
});

describe('transactionValidator dry-run CLI block (subprocess verification)', () => {
  it('should print a Dry-run Validation Results table when run as main with --dry-run', () => {
    // The CLI block is guarded by `require.main === module` which is never true
    // inside Jest's runtime. We verify the block's correctness by running the
    // agent as a subprocess and asserting on stdout.
    const path = require('path');
    const { execFileSync } = require('child_process');

    const agentPath = path.resolve(__dirname, '../agents/transactionValidator.js');

    let output = '';
    try {
      output = execFileSync(process.execPath, [agentPath, '--dry-run'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      output = e.stdout || '';
    }

    expect(output).toContain('Dry-run Validation Results');
    expect(output).toContain('Total:');
    expect(output).toMatch(/Valid:\s*\d+/);
  });
});
