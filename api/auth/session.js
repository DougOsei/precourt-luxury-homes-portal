const { handleAuthSessionCheckEndpoint } = require('../../server/auth');

module.exports = async function handler(req, res) {
  return handleAuthSessionCheckEndpoint(req, res);
};
