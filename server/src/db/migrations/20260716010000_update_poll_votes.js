/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('poll_votes');

  await knex.schema.createTable('poll_votes', (t) => {
    t.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('option_index').notNullable();
    t.string('custom_option');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.primary(['message_id', 'user_id', 'option_index']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('poll_votes');

  await knex.schema.createTable('poll_votes', (t) => {
    t.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('option_index').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.primary(['message_id', 'user_id']);
  });
};
