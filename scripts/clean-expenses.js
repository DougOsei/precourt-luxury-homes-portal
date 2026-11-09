/**
 * scripts/clean-expenses.js
 *
 * Dedicated database cleanup utility to permanently purge mock/test construction expenses
 * from the SQLite database and synced disk state (server/portal_state.json).
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'server', 'rental_manager.db');
const portalStatePath = path.join(__dirname, '..', 'server', 'portal_state.json');

function cleanExpenses() {
  console.log('🔄 Cleaning construction expenses from database and disk state...');

  // 1. Purge from SQLite database
  if (fs.existsSync(dbPath)) {
    try {
      const db = new Database(dbPath);
      const info = db.prepare('DELETE FROM project_expenses').run();
      console.log(`✅ SQLite project_expenses table cleared: ${info.changes} row(s) deleted.`);
      db.close();
    } catch (err) {
      console.error('❌ Error clearing SQLite project_expenses table:', err.message);
    }
  } else {
    console.log('ℹ️ SQLite database not found at:', dbPath);
  }

  // 2. Clear projectExpenses in server/portal_state.json
  if (fs.existsSync(portalStatePath)) {
    try {
      const raw = fs.readFileSync(portalStatePath, 'utf8');
      const state = JSON.parse(raw);
      const prevCount = Array.isArray(state.projectExpenses) ? state.projectExpenses.length : 0;
      state.projectExpenses = [];
      fs.writeFileSync(portalStatePath, JSON.stringify(state, null, 2), 'utf8');
      console.log(`✅ server/portal_state.json updated: cleared ${prevCount} expense(s).`);
    } catch (err) {
      console.error('❌ Error updating portal_state.json:', err.message);
    }
  } else {
    console.log('ℹ️ portal_state.json not found at:', portalStatePath);
  }

  console.log('🎉 Successfully cleaned all construction expenses from database and state.');
}

cleanExpenses();
