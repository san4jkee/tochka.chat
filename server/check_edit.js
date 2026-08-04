const pg = require('pg');
const config = require('./src/config');

async function test() {
  const c = new pg.Client(config.pg);
  await c.connect();

  // Get a message
  const msg = await c.query(`SELECT id, sender_id, content FROM messages WHERE is_deleted = false ORDER BY created_at DESC LIMIT 1`);
  console.log('Message:', msg.rows[0]);

  if (msg.rows[0]) {
    // Test update
    const updated = await c.query(`UPDATE messages SET content = $1, is_edited = true, updated_at = NOW() WHERE id = $2 RETURNING id, content, is_edited`, ['edited test', msg.rows[0].id]);
    console.log('Updated:', updated.rows[0]);
    // Restore
    await c.query(`UPDATE messages SET content = $1, is_edited = false WHERE id = $2`, [msg.rows[0].content, msg.rows[0].id]);
    console.log('Restored');
  }

  await c.end();
}
test().catch(e => { console.error(e.message); process.exit(1); });
