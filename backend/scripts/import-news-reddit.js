#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { importNewsRows } = require('../news-importer');

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

function parseCsv(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = lines[0].split(',').map((item) => item.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function parseInputFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf8');

  if (extension === '.json') {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  if (extension === '.jsonl' || extension === '.ndjson') {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  if (extension === '.csv') {
    return parseCsv(raw);
  }

  throw new Error(`Unsupported import file type: ${extension}. Use .json, .jsonl, .ndjson, or .csv`);
}

async function main() {
  const filePath = getArgValue('--file');
  const defaultTicker = getArgValue('--ticker');
  const defaultSource = getArgValue('--source') || 'imported';

  if (!filePath) {
    console.error('Usage: npm run import:news -- --file <path> [--ticker AAPL] [--source imported]');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Import file not found: ${absolutePath}`);
    process.exit(1);
  }

  const rows = parseInputFile(absolutePath);
  const result = await importNewsRows(rows, { defaultTicker, defaultSource });
  console.log(JSON.stringify({
    file: absolutePath,
    ...result
  }, null, 2));
}

main().catch((error) => {
  console.error('Import failed:', error.message || error);
  process.exit(1);
});
