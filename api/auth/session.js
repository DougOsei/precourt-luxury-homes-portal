const { handleSessionEndpoint } = require('../../server/security');

module.exports = async function handler(req, res) {
  return handleSessionEndpoint(req, res);
};
