const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const BCRYPT_ROUNDS = 10;

function generateApiKey() {
  const raw = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  return 'sk-' + raw.slice(0, 48);
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function getApiKeyPrefix(apiKey) {
  return apiKey.slice(0, 11); // sk-xxxxxxxx
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  generateApiKey,
  hashApiKey,
  getApiKeyPrefix,
  hashPassword,
  verifyPassword,
};
