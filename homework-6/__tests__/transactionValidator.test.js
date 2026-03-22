'use strict';

const { processMessage } = require('../agents/transactionValidator');

function makeMessage(data) {
  return {
    message_id: 'test-id',
    timestamp: new Date().toISOString(),
    source_agent: 'test',
    target_agent: 'transaction_validator',
    message_type: 'transaction',
    data,
  };
}

const validTxn = {
  transaction_id: 'TXN001',
  amount: '100.00',
  currency: 'USD',
  source_account: 'ACC-1234',
  destination_account: 'ACC-5678',
  timestamp: new Date().toISOString(),
};

describe('processMessage', () => {
  test('validates a correct transaction', () => {
    const result = processMessage(makeMessage({ ...validTxn }));
    expect(result.data.status).toBe('validated');
    expect(result.target_agent).toBe('fraud_detector');
  });

  test('rejects when a required field is missing', () => {
    const { currency, ...missing } = validTxn;
    const result = processMessage(makeMessage(missing));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
  });

  test('rejects invalid currency', () => {
    const result = processMessage(makeMessage({ ...validTxn, currency: 'XYZ' }));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('INVALID_CURRENCY');
  });

  test('rejects zero amount', () => {
    const result = processMessage(makeMessage({ ...validTxn, amount: '0' }));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
  });

  test('rejects negative amount', () => {
    const result = processMessage(makeMessage({ ...validTxn, amount: '-50' }));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
  });

  test('rejects non-numeric amount', () => {
    const result = processMessage(makeMessage({ ...validTxn, amount: 'abc' }));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('INVALID_AMOUNT');
  });

  test('uses UNKNOWN as txnId when transaction_id is missing', () => {
    const { transaction_id, ...missing } = validTxn;
    const result = processMessage(makeMessage(missing));
    expect(result.data.status).toBe('rejected');
    expect(result.data.rejection_reason).toBe('MISSING_FIELDS');
  });

  test('accepts all valid currencies', () => {
    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'HKD', 'NZD', 'SEK', 'SGD', 'NOK', 'DKK'];
    for (const currency of currencies) {
      const result = processMessage(makeMessage({ ...validTxn, currency }));
      expect(result.data.status).toBe('validated');
    }
  });
});
