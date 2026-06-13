const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_NAME = 'tally-claude-jobs';
const TTL_SECONDS = 60 * 60;
const TMP_DIR = path.join(os.tmpdir(), 'ph-tally-jobs');

function tmpPath(jobId) {
  return path.join(TMP_DIR, `${jobId.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

async function blobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

async function setJob(jobId, data) {
  try {
    const store = await blobStore();
    await store.setJSON(jobId, data, {
      metadata: { updatedAt: new Date().toISOString() },
      ttl: TTL_SECONDS,
    });
    return;
  } catch (_) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(tmpPath(jobId), JSON.stringify(data));
  }
}

async function getJob(jobId) {
  try {
    const store = await blobStore();
    return store.get(jobId, { type: 'json' });
  } catch (_) {
    const file = tmpPath(jobId);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }
}

module.exports = { setJob, getJob };
