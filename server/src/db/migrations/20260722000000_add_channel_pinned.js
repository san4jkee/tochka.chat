/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('channel_members', (t) => {
    t.boolean('is_pinned').defaultTo(false);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.alterTable('channel_members', (t) => {
    t.dropColumn('is_pinned');
  });
};
