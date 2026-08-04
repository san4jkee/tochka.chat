const db = require('../index');

async function findById(id) {
  return db('messages').where('id', id).first();
}

async function findByIdWithSender(id) {
  return db('messages as m')
    .leftJoin('users as s', 's.id', 'm.sender_id')
    .where('m.id', id)
    .select('m.*', 's.username as sender_username', 's.display_name as sender_display_name', 's.avatar as sender_avatar')
    .first();
}

async function findByChannel(channelId, { before, limit = 50 } = {}) {
  let query = db('messages as m')
    .leftJoin('users as s', 's.id', 'm.sender_id')
    .where('m.channel_id', channelId)
    .where('m.is_deleted', false)
    .orderBy('m.created_at', 'desc')
    .limit(limit);

  if (before) {
    query = query.where('m.created_at', '<', before);
  }

  const messages = await query.select(
    'm.*',
    's.username as sender_username',
    's.display_name as sender_display_name',
    's.avatar as sender_avatar'
  );

  for (const msg of messages) {
    msg.sender = {
      id: msg.sender_id,
      username: msg.sender_username,
      display_name: msg.sender_display_name,
      avatar: msg.sender_avatar
    };
    msg.mentions = await getMessageMentions(msg.id);
    msg.reactions = await getMessageReactions(msg.id);
    msg.readBy = await getMessageReadBy(msg.id);
    if (msg.type === 'poll') {
      msg.pollVotes = await getPollVotes(msg.id);
    }
    if (msg.reply_to) {
      msg.replyTo = await getReplyMessage(msg.reply_to);
    }
  }

  return messages.reverse();
}

async function create(data, mentionIds = []) {
  const insertData = { ...data };
  if (Array.isArray(insertData.attachments)) {
    insertData.attachments = JSON.stringify(insertData.attachments);
  }
  if (insertData.poll && typeof insertData.poll === 'object') {
    insertData.poll = JSON.stringify(insertData.poll);
  }
  const [message] = await db('messages').insert(insertData).returning('*');
  if (mentionIds.length > 0) {
    const rows = mentionIds.map((uid) => ({ message_id: message.id, user_id: uid }));
    await db('message_mentions').insert(rows);
  }
  message.sender = await db('users')
    .where('id', message.sender_id)
    .select('id', 'username', 'display_name', 'avatar')
    .first();
  message.mentions = mentionIds;
  message.reactions = [];
  message.readBy = [];
  if (message.reply_to) {
    message.replyTo = await getReplyMessage(message.reply_to);
  }
  return message;
}

async function updateById(id, data) {
  const updateData = { ...data };
  if (Array.isArray(updateData.attachments)) {
    updateData.attachments = JSON.stringify(updateData.attachments);
  }
  const [updated] = await db('messages')
    .where('id', id)
    .update({ ...updateData, updated_at: db.fn.now() })
    .returning('*');
  if (updated) {
    updated.sender = await db('users')
      .where('id', updated.sender_id)
      .select('id', 'username', 'display_name', 'avatar')
      .first();
    updated.reactions = await getMessageReactions(id);
    updated.mentions = await getMessageMentions(id);
    updated.readBy = await getMessageReadBy(id);
    if (updated.type === 'poll') {
      updated.pollVotes = await getPollVotes(id);
    }
    if (updated.reply_to) {
      updated.replyTo = await getReplyMessage(updated.reply_to);
    }
  }
  return updated;
}

async function softDelete(id) {
  const [updated] = await db('messages')
    .where('id', id)
    .update({ is_deleted: true, content: '', updated_at: db.fn.now() })
    .returning('*');
  return updated;
}

async function search(channelId, query) {
  const messages = await db('messages as m')
    .leftJoin('users as s', 's.id', 'm.sender_id')
    .where('m.channel_id', channelId)
    .where('m.is_deleted', false)
    .whereRaw('m.content ILIKE ?', [`%${query}%`])
    .orderBy('m.created_at', 'desc')
    .limit(50)
    .select(
      'm.*',
      's.username as sender_username',
      's.display_name as sender_display_name',
      's.avatar as sender_avatar'
    );

  for (const msg of messages) {
    msg.sender = {
      id: msg.sender_id,
      username: msg.sender_username,
      display_name: msg.sender_display_name,
      avatar: msg.sender_avatar
    };
  }

  return messages;
}

async function addReaction(messageId, emoji, userId) {
  const existing = await db('message_reactions')
    .where({ message_id: messageId, emoji, user_id: userId })
    .first();

  if (existing) {
    await db('message_reactions')
      .where({ message_id: messageId, emoji, user_id: userId })
      .del();
  } else {
    await db('message_reactions').insert({ message_id: messageId, emoji, user_id: userId });
  }

  return getMessageReactions(messageId);
}

async function addReadBy(messageId, userId) {
  await db('message_read_by')
    .insert({ message_id: messageId, user_id: userId })
    .onConflict(['message_id', 'user_id'])
    .ignore();
}

async function getPollVotes(messageId) {
  return db('poll_votes as pv')
    .join('users as u', 'u.id', 'pv.user_id')
    .where('pv.message_id', messageId)
    .select('pv.user_id', 'pv.option_index', 'pv.custom_option', 'u.display_name', 'u.avatar');
}

async function votePoll(messageId, userId, optionIndex, customOption = null) {
  const existing = await db('poll_votes')
    .where({ message_id: messageId, user_id: userId, option_index: optionIndex })
    .first();

  if (existing) {
    await db('poll_votes')
      .where({ message_id: messageId, user_id: userId, option_index: optionIndex })
      .del();
  } else {
    await db('poll_votes').insert({ message_id: messageId, user_id: userId, option_index: optionIndex, custom_option: customOption });
  }

  return getPollVotes(messageId);
}

async function getMessageMentions(messageId) {
  const rows = await db('message_mentions as mm')
    .join('users as u', 'u.id', 'mm.user_id')
    .where('mm.message_id', messageId)
    .select('u.id', 'u.username', 'u.display_name');
  return rows;
}

async function getMessageReactions(messageId) {
  const rows = await db('message_reactions as mr')
    .join('users as u', 'u.id', 'mr.user_id')
    .where('mr.message_id', messageId)
    .select('mr.emoji', 'u.id as user_id', 'u.username');

  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, users: [] };
    }
    grouped[r.emoji].users.push({ id: r.user_id, username: r.username });
  }
  return Object.values(grouped);
}

async function getMessageReadBy(messageId) {
  const rows = await db('message_read_by')
    .where('message_id', messageId)
    .select('user_id');
  return rows.map((r) => r.user_id);
}

async function getReplyMessage(messageId) {
  const msg = await db('messages as m')
    .leftJoin('users as s', 's.id', 'm.sender_id')
    .where('m.id', messageId)
    .select('m.*', 's.username as sender_username', 's.display_name as sender_display_name', 's.avatar as sender_avatar')
    .first();

  if (msg) {
    msg.sender = {
      id: msg.sender_id,
      username: msg.sender_username,
      display_name: msg.sender_display_name,
      avatar: msg.sender_avatar
    };
  }
  return msg;
}

module.exports = {
  findById,
  findByIdWithSender,
  findByChannel,
  create,
  updateById,
  softDelete,
  search,
  addReaction,
  addReadBy,
  getPollVotes,
  votePoll
};
