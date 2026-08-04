const db = require('../index');

async function findById(id) {
  return db('channels').where('id', id).first();
}

async function findMemberChannels(userId) {
  const channels = await db('channels as c')
    .join('channel_members as cm', 'cm.channel_id', 'c.id')
    .where('cm.user_id', userId)
    .where('c.is_archived', false)
    .select('c.*', 'cm.is_pinned')
    .orderBy('cm.is_pinned', 'desc')
    .orderBy('cm.pinned_at', 'desc')
    .orderBy('c.last_message_at', 'desc');

  for (const ch of channels) {
    ch.members = await getMembers(ch.id);
    ch.createdBy = await getCreator(ch.created_by);
    ch.mutedBy = await getMutedBy(ch.id);
    ch.lastMessage = ch.last_message_id
      ? await db('messages as m')
          .leftJoin('users as s', 's.id', 'm.sender_id')
          .where('m.id', ch.last_message_id)
          .select('m.*', 's.username as sender_username', 's.display_name as sender_display_name', 's.avatar as sender_avatar')
          .first()
      : null;
  }

  return channels;
}

async function findPublicChannels(userId) {
  const channels = await db('channels as c')
    .where('c.type', 'public')
    .where('c.is_archived', false)
    .whereNotExists(function () {
      this.select(db.raw('1'))
        .from('channel_members as cm')
        .whereColumn('cm.channel_id', 'c.id')
        .where('cm.user_id', userId);
    })
    .orderBy('c.created_at', 'desc');

  for (const ch of channels) {
    ch.createdBy = await getCreator(ch.created_by);
  }

  return channels;
}

async function findDirectChannel(userId1, userId2) {
  const channel = await db('channels as c')
    .where('c.type', 'direct')
    .whereExists(function () {
      this.select(db.raw('1'))
        .from('channel_members as cm')
        .whereColumn('cm.channel_id', 'c.id')
        .where('cm.user_id', userId1);
    })
    .whereExists(function () {
      this.select(db.raw('1'))
        .from('channel_members as cm')
        .whereColumn('cm.channel_id', 'c.id')
        .where('cm.user_id', userId2);
    })
    .whereRaw(`
      (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) = 2
    `)
    .first();

  if (channel) {
    channel.members = await getMembers(channel.id);
    channel.createdBy = await getCreator(channel.created_by);
    channel.mutedBy = await getMutedBy(channel.id);
  }

  return channel;
}

async function create(data, memberIds) {
  const [channel] = await db('channels').insert(data).returning('*');
  if (memberIds && memberIds.length > 0) {
    const rows = memberIds.map((uid) => ({ channel_id: channel.id, user_id: uid }));
    await db('channel_members').insert(rows);
  }
  return channel;
}

async function addMember(channelId, userId) {
  await db('channel_members')
    .insert({ channel_id: channelId, user_id: userId })
    .onConflict(['channel_id', 'user_id'])
    .ignore();
}

async function removeMember(channelId, userId) {
  await db('channel_members')
    .where({ channel_id: channelId, user_id: userId })
    .del();
}

async function isMember(channelId, userId) {
  const row = await db('channel_members')
    .where({ channel_id: channelId, user_id: userId })
    .first();
  return !!row;
}

async function updateById(id, data) {
  const [updated] = await db('channels')
    .where('id', id)
    .update({ ...data, updated_at: db.fn.now() })
    .returning('*');
  return updated;
}

async function updateLastMessage(channelId, messageId) {
  await db('channels')
    .where('id', channelId)
    .update({ last_message_id: messageId, last_message_at: new Date() });
}

async function getMembers(channelId) {
  return db('channel_members as cm')
    .join('users as u', 'u.id', 'cm.user_id')
    .where('cm.channel_id', channelId)
    .select('u.id', 'u.username', 'u.display_name', 'u.avatar', 'u.status', 'u.email', 'u.department', 'u.last_seen');
}

async function getMutedBy(channelId) {
  return db('channel_muted_by')
    .where('channel_id', channelId)
    .select('user_id');
}

async function toggleMute(channelId, userId) {
  const existing = await db('channel_muted_by')
    .where({ channel_id: channelId, user_id: userId })
    .first();

  if (existing) {
    await db('channel_muted_by')
      .where({ channel_id: channelId, user_id: userId })
      .del();
    return false;
  } else {
    await db('channel_muted_by').insert({ channel_id: channelId, user_id: userId });
    return true;
  }
}

async function togglePin(channelId, userId) {
  const member = await db('channel_members')
    .where({ channel_id: channelId, user_id: userId })
    .first();

  if (!member) return { pinned: false, pinnedAt: null };

  const newState = !member.is_pinned;
  const pinnedAt = newState ? new Date() : null;
  await db('channel_members')
    .where({ channel_id: channelId, user_id: userId })
    .update({ is_pinned: newState, pinned_at: pinnedAt });
  return { pinned: newState, pinnedAt };
}

async function getCreator(userId) {
  return db('users')
    .where('id', userId)
    .select('id', 'username', 'display_name')
    .first();
}

module.exports = {
  findById,
  findMemberChannels,
  findPublicChannels,
  findDirectChannel,
  create,
  addMember,
  removeMember,
  isMember,
  updateById,
  updateLastMessage,
  getMembers,
  getMutedBy,
  toggleMute,
  togglePin,
  getCreator
};
