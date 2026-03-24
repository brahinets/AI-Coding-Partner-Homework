Validate all transactions in sample-transactions.json without running the full pipeline.

Steps:
1. Run the validator in dry-run mode: `cd homework-6 && node agents/transactionValidator.js --dry-run`
2. Parse the output and report:
   - Total transaction count
   - Valid count
   - Invalid count
   - Reasons for rejection with counts
3. Show a table of results: one row per transaction with transaction_id, valid/invalid status, and rejection reason if applicable