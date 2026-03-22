Run the multi-agent banking pipeline end-to-end.

Steps:
1. Check that `homework-6/sample-transactions.json` exists — abort with a clear error if missing
2. Clear all files from `homework-6/shared/input/`, `shared/output/`, `shared/processing/`, `shared/compliance/`, and `shared/results/`
3. Run the pipeline: `cd homework-6 && node integrator.js`
4. Show a summary table of results from `homework-6/shared/results/` — one row per transaction with: transaction_id, status, fraud_risk_level, rejection_reason (if any), compliance_flag (if any)
5. Report any transactions that were rejected and explain why
