/**
 * Encryption Library - Envelope Encryption with AES-256-GCM
 * 
 * SECURITY NOTES:
 * - In production, use KMS (AWS KMS, GCP KMS, HashiCorp Vault) to wrap/unwrap data keys
 * - Never store MASTER_KEY in plaintext on disk; use environment secrets or secret manager
 * - This implementation uses envelope encryption: per-record data keys encrypted with master key
 */

const crypto = require('crypto');

const ENCRYPTION_ALGO = process.env.ENCRYPTION_ALGO || 'aes-256-gcm';
const REDACT_PII = process.env.REDACT_PII === 'true';
const IV_LENGTH = 16; // 128 bits for GCM
const TAG_LENGTH = 16; // 128 bits for authentication tag
const DATA_KEY_LENGTH = 32; // 256 bits

/**
 * Generate a random data key and encrypt it with the master key
 * @returns {Object} { dataKey: Buffer, encryptedDataKey: string (base64), iv: string (base64) }
 */
function generateDataKey(masterKeyBase64) {
  if (!masterKeyBase64) {
    throw new Error('MASTER_KEY_BASE64 is required');
  }

  // Generate random data key (32 bytes = 256 bits)
  const dataKey = crypto.randomBytes(DATA_KEY_LENGTH);
  
  // Generate IV for encrypting the data key
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Decode master key from base64
  const masterKey = Buffer.from(masterKeyBase64, 'base64');
  if (masterKey.length !== DATA_KEY_LENGTH) {
    throw new Error(`MASTER_KEY_BASE64 must decode to ${DATA_KEY_LENGTH} bytes (got ${masterKey.length})`);
  }

  // Encrypt data key with master key using AES-256-GCM
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, masterKey, iv);
  cipher.setAAD(Buffer.from('data-key')); // Additional authenticated data
  
  let encryptedDataKey = cipher.update(dataKey);
  encryptedDataKey = Buffer.concat([encryptedDataKey, cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    dataKey,
    encryptedDataKey: encryptedDataKey.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

/**
 * Encrypt a payload using envelope encryption
 * @param {string} plaintext - The text to encrypt
 * @param {string} masterKeyBase64 - Base64-encoded master key
 * @returns {Object} { ciphertextBase64, encryptedDataKeyBase64, ivBase64, tagBase64, dataKeyIv, dataKeyTag }
 */
function encryptPayload(plaintext, masterKeyBase64) {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('plaintext must be a non-empty string');
  }
  
  if (!masterKeyBase64) {
    throw new Error('MASTER_KEY_BASE64 is required');
  }

  // Generate data key and encrypt it with master key
  const { dataKey, encryptedDataKey, iv: dataKeyIv, tag: dataKeyTag } = generateDataKey(masterKeyBase64);
  
  // Encrypt payload with data key
  const payloadIv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, dataKey, payloadIv);
  cipher.setAAD(Buffer.from('payload')); // Additional authenticated data
  
  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const payloadTag = cipher.getAuthTag();
  
  return {
    ciphertextBase64: ciphertext.toString('base64'),
    encryptedDataKeyBase64: encryptedDataKey,
    ivBase64: payloadIv.toString('base64'),
    tagBase64: payloadTag.toString('base64'),
    // Store data key encryption metadata separately (for rotation)
    dataKeyIv: dataKeyIv.toString('base64'),
    dataKeyTag: dataKeyTag.toString('base64')
  };
}

/**
 * Decrypt a payload using envelope encryption
 * @param {Object} encrypted - { ciphertextBase64, encryptedDataKeyBase64, ivBase64, tagBase64 }
 * @param {string} masterKeyBase64 - Base64-encoded master key
 * @returns {string} Decrypted plaintext
 */
function decryptPayload(encrypted, masterKeyBase64) {
  if (!encrypted || !encrypted.ciphertextBase64 || !encrypted.encryptedDataKeyBase64 || 
      !encrypted.ivBase64 || !encrypted.tagBase64) {
    throw new Error('Invalid encrypted payload structure');
  }
  
  if (!masterKeyBase64) {
    throw new Error('MASTER_KEY_BASE64 is required');
  }

  try {
    // Decode master key
    const masterKey = Buffer.from(masterKeyBase64, 'base64');
    if (masterKey.length !== DATA_KEY_LENGTH) {
      throw new Error(`Invalid master key length`);
    }

    // Decrypt data key (if we have dataKeyIv and dataKeyTag, use them; otherwise assume old format)
    let dataKey;
    if (encrypted.dataKeyIv && encrypted.dataKeyTag) {
      // New format: data key was encrypted with master key
      const dataKeyIv = Buffer.from(encrypted.dataKeyIv, 'base64');
      const dataKeyTag = Buffer.from(encrypted.dataKeyTag, 'base64');
      const encryptedDataKey = Buffer.from(encrypted.encryptedDataKeyBase64, 'base64');
      
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, masterKey, dataKeyIv);
      decipher.setAuthTag(dataKeyTag);
      decipher.setAAD(Buffer.from('data-key'));
      
      dataKey = decipher.update(encryptedDataKey);
      dataKey = Buffer.concat([dataKey, decipher.final()]);
    } else {
      // Legacy format: assume encryptedDataKeyBase64 is the data key itself (for migration)
      // In production, this should not happen, but we support it for backward compatibility
      console.warn('⚠️  Using legacy decryption format (data key not wrapped)');
      dataKey = Buffer.from(encrypted.encryptedDataKeyBase64, 'base64');
    }

    // Decrypt payload with data key
    const iv = Buffer.from(encrypted.ivBase64, 'base64');
    const tag = Buffer.from(encrypted.tagBase64, 'base64');
    const ciphertext = Buffer.from(encrypted.ciphertextBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, dataKey, iv);
    decipher.setAuthTag(tag);
    decipher.setAAD(Buffer.from('payload'));
    
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);
    
    return plaintext.toString('utf8');
  } catch (err) {
    if (err.message.includes('Unsupported state') || err.message.includes('bad decrypt')) {
      throw new Error('Decryption failed: invalid key or tampered data');
    }
    throw err;
  }
}

/**
 * Redact PII from text if REDACT_PII is enabled
 * @param {string} text - Text that may contain PII
 * @returns {string} Text with PII redacted (if enabled)
 */
function redactPII(text) {
  if (!REDACT_PII || !text || typeof text !== 'string') {
    return text;
  }

  // Simple email pattern
  let redacted = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
  
  // Simple phone pattern (US format)
  redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
  
  // Credit card pattern (simple)
  redacted = redacted.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD_REDACTED]');
  
  return redacted;
}

/**
 * Check if a document field is encrypted
 * @param {Object} field - Field value (could be encrypted object or plaintext)
 * @returns {boolean} True if field has encrypted structure
 */
function isEncrypted(field) {
  return field && 
         typeof field === 'object' && 
         field.c && // ciphertext
         field.k && // encrypted data key
         field.iv && // IV
         field.t; // tag
}

/**
 * Format encrypted payload for storage (compact format)
 * @param {Object} encrypted - Result from encryptPayload()
 * @returns {Object} { c, k, iv, t } (compact field names)
 */
function formatForStorage(encrypted) {
  return {
    c: encrypted.ciphertextBase64,
    k: encrypted.encryptedDataKeyBase64,
    iv: encrypted.ivBase64,
    t: encrypted.tagBase64,
    // Store data key encryption metadata for rotation
    dkiv: encrypted.dataKeyIv ? encrypted.dataKeyIv.toString('base64') : undefined,
    dktag: encrypted.dataKeyTag ? encrypted.dataKeyTag.toString('base64') : undefined
  };
}

/**
 * Parse encrypted payload from storage format
 * @param {Object} stored - { c, k, iv, t, dkiv?, dktag? }
 * @returns {Object} { ciphertextBase64, encryptedDataKeyBase64, ivBase64, tagBase64, dataKeyIv?, dataKeyTag? }
 */
function parseFromStorage(stored) {
  return {
    ciphertextBase64: stored.c,
    encryptedDataKeyBase64: stored.k,
    ivBase64: stored.iv,
    tagBase64: stored.t,
    dataKeyIv: stored.dkiv,
    dataKeyTag: stored.dktag
  };
}

module.exports = {
  generateDataKey,
  encryptPayload,
  decryptPayload,
  redactPII,
  isEncrypted,
  formatForStorage,
  parseFromStorage,
  ENCRYPTION_ALGO,
  REDACT_PII
};

