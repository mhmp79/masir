'use strict';

/* Offline user provisioning: set a phone + password directly in PostgreSQL.
   Useful before an SMS provider is configured, and for creating the first admin. */

const {
  normalizePhone,
  hashPassword,
  userColumns,
  findUser,
  upsertUser,
  setUserPassword,
} = require('../src/auth');
const { withTransaction, closePool } = require('../src/db');

const HELP = `Usage: node scripts/create-user.js --phone <phone> --password <password> [options]

Options:
  --phone, -p       Iranian phone: 09xxxxxxxxx, 989xxxxxxxxx or +989xxxxxxxxx
  --password        Password (at least 8 characters)
  --role            student (default), advisor or admin
  --name            Optional display name
  --reset           Only change the password of an existing phone
  --help, -h        Show this message

Examples:
  node scripts/create-user.js -p 09123456789 --password 'StrongPass123' --role admin
  node scripts/create-user.js -p 09123456789 --password 'NewPass123' --reset

No OTP or SMS gateway is needed. The same scrypt hash format as the API is used,
so the user can immediately sign in with phone + password in the app.`;

function parseArgs(argv) {
  const options = { help: false, reset: false };
  const aliases = {
    p: 'phone',
    phone: 'phone',
    password: 'password',
    role: 'role',
    name: 'displayName',
    displayname: 'displayName',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (raw === '--help' || raw === '-h') {
      options.help = true;
      continue;
    }
    if (raw === '--reset') {
      options.reset = true;
      continue;
    }
    if (!raw.startsWith('--')) throw new Error(`Unknown argument: ${raw}`);
    const equalsAt = raw.indexOf('=');
    const key = (equalsAt >= 0 ? raw.slice(2, equalsAt) : raw.slice(2)).toLowerCase();
    const property = aliases[key];
    if (!property) throw new Error(`Unknown option: ${raw}`);
    const value = equalsAt >= 0 ? raw.slice(equalsAt + 1) : argv[++i];
    if (value === undefined || value === '') throw new Error(`Missing value for ${raw}`);
    options[property] = value;
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }

  const phone = normalizePhone(options.phone);
  if (!phone) {
    throw new Error('Invalid phone. Use 09xxxxxxxxx, 989xxxxxxxxx or +989xxxxxxxxx.');
  }
  if (!options.password) throw new Error('Missing --password (at least 8 characters).');

  const columns = await userColumns();
  const passwordHash = await hashPassword(options.password);

  if (options.reset) {
    const changed = await withTransaction(async (client) => {
      const row = await findUser(columns.phone, phone, columns, client, true);
      if (!row) return false;
      await setUserPassword(client, columns, row[columns.id], passwordHash);
      return true;
    });
    if (!changed) {
      throw new Error('No user has this phone. Run without --reset to create the account first.');
    }
    console.log(`[create-user] password updated for ${phone}`);
    return;
  }

  const role = String(options.role || 'student').trim().toLowerCase();
  if (!['student', 'advisor', 'admin'].includes(role)) {
    throw new Error('role must be student, advisor or admin');
  }

  const user = await withTransaction(async (client) => {
    const existing = await findUser(columns.phone, phone, columns, client, true);
    if (existing) {
      throw new Error('A user with this phone already exists. Use --reset to change the password.');
    }
    return upsertUser(client, phone, columns, {
      role,
      displayName: options.displayName,
      passwordHash,
    });
  });

  console.log(`[create-user] created ${role} ${phone} (id=${user.id}, name=${user.displayName || '-'})`);
  console.log('[create-user] the user can now sign in with this phone and the password you supplied.');
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(`[create-user] failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool().catch(() => {});
  }
})();
