const path = require('path');
require('dotenv').config({
  path: path.join(process.cwd(), '.env'),
  override: true,
});

const { createApp } = require('../../server/createApp');

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
