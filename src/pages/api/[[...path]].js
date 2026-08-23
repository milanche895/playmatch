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
