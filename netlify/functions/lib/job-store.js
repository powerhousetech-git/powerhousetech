const fs = require('fs');
const path = require('path');
const os = require('os');
const { connectLambda, getStore } = require('@netlify/blobs');

const STORE_NAME = 'tally-claude-jobs';
const TTL_SECONDS = 60 * 60;
const TMP_DIR = path.join(os.tmpdir(), 'ph-tally-jobs');

function isLocalDev() {
  return process.env.NETLIFY_DEV === 'true';
}

function tmpPath(jobId) {
  return path.join(TMP_DIR, `${jobId.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

function blobStore(event) {
  if (isLocalDev()) {
    throw new Error('local-tmp');
  }

  if (event) {
    connectLambda(event);
  }

  // Default (eventual) consistency — strong consistency needs uncachedEdgeURL
  // which is not available in Lambda compatibility mode.
  return getStore(STORE_NAME);
}

async function setJob(jobId, data, event) {
  try {
    const store = blobStore(event);
    await store.setJSON(jobId, data, {
      metadata: { updatedAt: new Date().toISOString() },
      ttl: TTL_SECONDS,
    });
  } catch (err) {
    if (!isLocalDev() && err.message !== 'local-tmp') {
      throw new Error('Job storage unavailable: ' + (err.message || 'Netlify Blobs error'));
    }
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(tmpPath(jobId), JSON.stringify(data));
  }
}

async function getJob(jobId, event) {
  try {
    const store = blobStore(event);
    return store.get(jobId, { type: 'json' });
  } catch (err) {
    if (!isLocalDev() && err.message !== 'local-tmp') {
      throw new Error('Job storage unavailable: ' + (err.message || 'Netlify Blobs error'));
    }
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
