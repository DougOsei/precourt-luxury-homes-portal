/**
 * Database Seed Entrypoint (prisma/seed.js -> delegates to server/seed.js & server/auth.js)
 * Seeds:
 * 1. Default Super Admin account (credentials read from .env.local)
 * 2. Initial Facility Manager account for Douglas Amadie (role: FACILITY_MANAGER, status: Active)
 * 3. Precourt Luxury Homes 16-tenant dataset across PLH-AM & PLH-KW
 */
const { seedDatabase } = require('../server/seed');
const { loadManagersStore, saveManagersStore, buildDefaultSeededManagers } = require('../server/auth');

async function main() {
  seedDatabase();
  const seededManagers = buildDefaultSeededManagers();
  await saveManagersStore(seededManagers);
  const current = await loadManagersStore();
  console.log(
    'Seeded Managers:',
    current.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      email: m.email,
      role: m.role,
      status: m.status,
      assignedProperties: m.assignedProperties
    }))
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
