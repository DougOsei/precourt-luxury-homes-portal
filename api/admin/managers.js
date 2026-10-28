const { handleAdminManagersEndpoint } = require('../../server/auth');

module.exports = async function handler(req, res) {
  return handleAdminManagersEndpoint(req, res);
};
