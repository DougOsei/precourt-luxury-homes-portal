const { handleAuthLoginEndpoint } = require('../../server/auth');

module.exports = async function handler(req, res) {
  return handleAuthLoginEndpoint(req, res);
};
