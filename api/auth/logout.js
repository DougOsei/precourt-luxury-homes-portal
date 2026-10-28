const { handleAuthLogoutEndpoint } = require('../../server/auth');

module.exports = async function handler(req, res) {
  return handleAuthLogoutEndpoint(req, res);
};
