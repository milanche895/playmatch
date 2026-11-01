const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');

const { catchAsyncErrors, apiErrorHandler } = require('../src/server/middleware/asyncErrors');

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function buildApp() {
  const router = express.Router();
  router.get('/cast/:id', async () => {
    throw new mongoose.Error.CastError('ObjectId', 'abc', '_id');
  });
  router.get('/boom', async () => {
    throw new Error('boom');
  });
  router.get('/ok', async (req, res) => {
    res.json({ ok: true });
  });

  const app = express();
  app.use('/api/test', catchAsyncErrors(router));
  app.use('/api', apiErrorHandler);
  return app;
}

test('async handler with an invalid id answers 404 instead of hanging', async () => {
  await withServer(buildApp(), async (base) => {
    const res = await fetch(`${base}/api/test/cast/abc`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).message, 'Nije pronađeno');
  });
});

test('unexpected async error answers 500 JSON', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    await withServer(buildApp(), async (base) => {
      const res = await fetch(`${base}/api/test/boom`);
      assert.equal(res.status, 500);
      assert.equal((await res.json()).message, 'Greška servera');
    });
  } finally {
    console.error = originalError;
  }
});

test('successful async handler is unaffected', async () => {
  await withServer(buildApp(), async (base) => {
    const res = await fetch(`${base}/api/test/ok`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });
});
