#!/usr/bin/env node
import { buildRuntime } from './project-lm-runtime-lib.mjs';

try {
  const result = await buildRuntime();
  console.log(`Project LM runtime generated successfully.`);
  console.log(`Files copied: ${result.filesCopied}`);
  console.log(`Total size: ${result.totalBytes} bytes`);
  console.log(`Entrypoints:\n- ${result.entrypoints.join('\n- ')}`);
  console.log(`Dependencies included:\n- ${result.files.map((file) => file.source).join('\n- ')}`);
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
