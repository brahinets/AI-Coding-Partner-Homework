'use strict';

const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');

const RESULTS_DIR = path.join(__dirname, '..', 'shared', 'results');

const server = new McpServer({
  name: 'pipeline-status',
  version: '1.0.0',
});

// Tool: get_transaction_status
server.tool(
  'get_transaction_status',
  { transaction_id: z.string().describe('Transaction ID to look up (e.g. TXN001)') },
  async ({ transaction_id }) => {
    const filePath = path.join(RESULTS_DIR, `${transaction_id}.json`);
    if (!fs.existsSync(filePath)) {
      return {
        content: [{ type: 'text', text: `Transaction ${transaction_id} not found.` }],
      };
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const summary = [
      `transaction_id : ${data.transaction_id}`,
      `status         : ${data.status}`,
      `amount         : ${data.amount} ${data.currency}`,
      `fraud_risk     : ${data.fraud_risk_level || 'N/A'} (score: ${data.fraud_risk_score ?? 'N/A'})`,
      `compliance     : ${data.compliance_status || 'N/A'}${data.compliance_flag ? ' (' + data.compliance_flag + ')' : ''}`,
      `rejection      : ${data.rejection_reason || '—'}`,
      `settlement_id  : ${data.settlement_id || '—'}`,
    ].join('\n');
    return { content: [{ type: 'text', text: summary }] };
  },
);

// Tool: list_pipeline_results
server.tool('list_pipeline_results', {}, async () => {
  const files = fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.json') && f !== 'pipeline-report.json');
  if (files.length === 0) {
    return { content: [{ type: 'text', text: 'No transactions processed yet.' }] };
  }
  const rows = files.map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
    return `${d.transaction_id.padEnd(10)} ${(d.status || '?').padEnd(10)} ${d.fraud_risk_level || 'N/A'}${d.rejection_reason ? '  reason: ' + d.rejection_reason : ''}`;
  });
  const header = `${'TXN ID'.padEnd(10)} ${'STATUS'.padEnd(10)} RISK`;
  const text = [header, '-'.repeat(50), ...rows].join('\n');
  return { content: [{ type: 'text', text: text }] };
});

// Resource: pipeline://summary
server.resource('pipeline-summary', 'pipeline://summary', async (uri) => {
  const reportPath = path.join(RESULTS_DIR, 'pipeline-report.json');
  if (!fs.existsSync(reportPath)) {
    return { contents: [{ uri: uri.href, text: 'No pipeline report found. Run the pipeline first.' }] };
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const text = [
    `Pipeline Summary — generated at ${report.generated_at}`,
    `Total      : ${report.total_transactions}`,
    `Settled    : ${report.settled_count}`,
    `Rejected   : ${report.rejected_count}`,
    `Risk levels: LOW=${report.by_risk_level.LOW} MEDIUM=${report.by_risk_level.MEDIUM} HIGH=${report.by_risk_level.HIGH}`,
    `AML review : ${report.aml_review_required.length > 0 ? report.aml_review_required.join(', ') : 'none'}`,
    `Rejections : ${JSON.stringify(report.rejection_reasons)}`,
  ].join('\n');
  return { contents: [{ uri: uri.href, text }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP server error: ${err.message}\n`);
  process.exit(1);
});
