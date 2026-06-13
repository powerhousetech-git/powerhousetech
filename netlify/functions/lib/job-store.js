const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_NAME = 'tally-claude-jobs';
const TMP_DIR = path.join(os.tmpdir(), 'ph-tally-jobs');
const IS_DEV = process.env.NETLIFY_DEV === 'true';

function tmpPath(jobId) {
  return path.join(TMP_DIR, `${jobId.replace(/[^a-zA-Z0-9_-]/g, '')}.json`);
}

function getBlobStore(event) {
  const { connectLambda, getStore } = require('@netlify/blobs');
  if (event && !IS_DEV) connectLambda(event);
  return getStore(STORE_NAME);
}

async function setJobTmp(jobId, data) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(tmpPath(jobId), JSON.stringify(data));
}

async function setJob(jobId, data, event) {
  try {
    const store = getBlobStore(event);
    await store.setJSON(jobId, data, {
      metadata: { updatedAt: new Date().toISOString() },
    });
    return;
  } catch (err) {
    if (IS_DEV) {
      await setJobTmp(jobId, data);
      return;
    }
    console.error('Blob setJob failed:', err);
    throw new Error('Could not save mapping job. Netlify Blobs may be unavailable.');
  }
}

async function getJob(jobId, event) {
  try {
    const store = getBlobStore(event);
    const job = await store.get(jobId, { type: 'json' });
    if (job) return job;
  } catch (err) {
    if (!IS_DEV) console.error('Blob getJob failed:', err);
  }

  if (IS_DEV) {
    const file = tmpPath(jobId);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = { setJob, getJob };
