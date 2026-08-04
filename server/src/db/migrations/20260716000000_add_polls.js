/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.raw("ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check");
  await knex.raw("ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'file', 'image', 'system', 'poll'))");

  await knex.schema.alterTable('messages', (t) => {
    t.jsonb('poll');
  });

  await knex.schema.createTable('poll_votes', (t) => {
    t.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('option_index').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.primary(['message_id', 'user_id']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('poll_votes');
  await knex.schema.alterTable('messages', (t) => {
    t.dropColumn('poll');
  });
  await knex.raw("ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check");
  await knex.raw("ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('text', 'file', 'image', 'system'))");
};
