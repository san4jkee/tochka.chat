/**
 * @param {import('knex').Knex} knex
 */
exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('username').notNullable().unique();
    t.string('display_name').notNullable();
    t.string('email').defaultTo('');
    t.string('password');
    t.string('avatar').defaultTo('');
    t.string('status').defaultTo('offline');
    t.timestamp('last_seen').defaultTo(knex.fn.now());
    t.boolean('ad_synced').defaultTo(false);
    t.specificType('roles', 'text[]').defaultTo('{}');
    t.string('department').defaultTo('');
    t.timestamps(true, true);
    t.index('username');
    t.index('display_name');
  });

  await knex.schema.createTable('channels', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name').notNullable();
    t.string('description').defaultTo('');
    t.string('avatar').defaultTo('');
    t.string('type').notNullable().checkIn(['public', 'private', 'direct']);
    t.uuid('created_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('last_message_id');
    t.timestamp('last_message_at').defaultTo(knex.fn.now());
    t.boolean('is_archived').defaultTo(false);
    t.timestamps(true, true);
    t.index('type');
    t.index('created_by');
    t.index('last_message_at');
  });

  await knex.schema.createTable('channel_members', (t) => {
    t.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['channel_id', 'user_id']);
  });

  await knex.schema.createTable('channel_muted_by', (t) => {
    t.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['channel_id', 'user_id']);
  });

  await knex.schema.createTable('messages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
    t.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('content').defaultTo('');
    t.string('type').defaultTo('text').checkIn(['text', 'file', 'image', 'system']);
    t.jsonb('attachments').defaultTo('[]');
    t.uuid('reply_to').references('id').inTable('messages').onDelete('SET NULL');
    t.string('forwarded_from').defaultTo('');
    t.uuid('forwarded_from_channel').references('id').inTable('channels').onDelete('SET NULL');
    t.uuid('forwarded_from_message').references('id').inTable('messages').onDelete('SET NULL');
    t.boolean('is_edited').defaultTo(false);
    t.boolean('is_pinned').defaultTo(false);
    t.boolean('is_deleted').defaultTo(false);
    t.timestamps(true, true);
    t.index(['channel_id', 'created_at']);
  });

  await knex.raw(`
    ALTER TABLE channels
    ADD CONSTRAINT channels_last_message_id_fk
    FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL
  `);

  await knex.schema.createTable('message_mentions', (t) => {
    t.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['message_id', 'user_id']);
  });

  await knex.schema.createTable('message_reactions', (t) => {
    t.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE');
    t.string('emoji').notNullable();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['message_id', 'emoji', 'user_id']);
    t.index(['message_id', 'emoji']);
  });

  await knex.schema.createTable('message_read_by', (t) => {
    t.uuid('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['message_id', 'user_id']);
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('message_read_by');
  await knex.schema.dropTableIfExists('message_reactions');
  await knex.schema.dropTableIfExists('message_mentions');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('channel_muted_by');
  await knex.schema.dropTableIfExists('channel_members');
  await knex.schema.dropTableIfExists('channels');
  await knex.schema.dropTableIfExists('users');
};
