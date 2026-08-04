const db = require('./index');

async function seedGeneralChannel() {
  const channelCount = await db('channels').count('id as cnt').first();
  if (parseInt(channelCount.cnt) > 0) return;

  const user = await db('users').orderBy('created_at').first();
  if (!user) return;

  const [channel] = await db('channels').insert({
    name: 'General',
    description: 'Основной канал для общения',
    type: 'public',
    created_by: user.id
  }).returning('*');

  await db('channel_members').insert({ channel_id: channel.id, user_id: user.id });
  console.log('Created default "General" channel');
}

module.exports = { seedGeneralChannel };
