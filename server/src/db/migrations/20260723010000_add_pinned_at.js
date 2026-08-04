/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('channel_members', (t) => {
    t.timestamp('pinned_at').nullable();
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('channel_members', (t) => {
    t.dropColumn('pinned_at');
  });
};
