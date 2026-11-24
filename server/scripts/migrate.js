'use strict';

const { migrate, closePool } = require('../src/db');

(async () => {
  try {
    await migrate();
    await closePool();
  } catch (error) {
    console.error('[migrate] failed:', error.stack || error.message);
    await closePool().catch(() => {});
    process.exitCode = 1;
  }
})();
