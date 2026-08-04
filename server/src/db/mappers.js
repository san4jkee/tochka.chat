function mapUser(u) {
  if (!u) return null;
  return {
    _id: u.id,
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    email: u.email || '',
    avatar: u.avatar || '',
    status: u.status,
    lastSeen: u.last_seen,
    adSynced: u.ad_synced,
    roles: u.roles || [],
    department: u.department || '',
    createdAt: u.created_at,
    updatedAt: u.updated_at
  };
}

function mapChannel(ch) {
  if (!ch) return null;
  return {
    _id: ch.id,
    id: ch.id,
    name: ch.name,
    description: ch.description || '',
    avatar: ch.avatar || '',
    type: ch.type,
    members: (ch.members || []).map(mapUser),
    mutedBy: (ch.mutedBy || []).map(m => m._id || m.id || m.user_id || m),
    createdBy: ch.createdBy ? mapUser(ch.createdBy) : null,
    lastMessage: ch.lastMessage ? mapMessage(ch.lastMessage) : null,
    lastMessageAt: ch.last_message_at,
    pinnedMessages: [],
    isArchived: ch.is_archived,
    isPinned: ch.is_pinned || false,
    pinnedAt: ch.pinned_at || null,
    createdAt: ch.created_at,
    updatedAt: ch.updated_at
  };
}

function mapMessage(m) {
  if (!m) return null;
  return {
    _id: m.id,
    id: m.id,
    channel: m.channel_id,
    sender: m.sender ? mapUser(m.sender) : {
      _id: m.sender_id || m.senderId,
      id: m.sender_id || m.senderId,
      username: m.sender_username || m.senderUsername,
      displayName: m.sender_display_name || m.senderDisplayName,
      avatar: m.sender_avatar || m.senderAvatar
    },
    content: m.content || '',
    type: m.type || 'text',
    attachments: m.attachments || [],
    poll: m.poll || null,
    pollVotes: (m.pollVotes || []).map(v => ({ userId: v.user_id, optionIndex: v.option_index, customOption: v.custom_option, displayName: v.display_name, avatar: v.avatar })),
    mentions: (m.mentions || []).map(mapUser),
    reactions: (m.reactions || []).map(r => ({
      emoji: r.emoji,
      users: (r.users || []).map(mapUser)
    })),
    replyTo: m.replyTo ? mapMessage(m.replyTo) : null,
    forwardedFrom: m.forwarded_from || '',
    forwardedFromChannel: m.forwarded_from_channel || null,
    forwardedFromMessage: m.forwarded_from_message || null,
    isEdited: m.is_edited,
    isPinned: m.is_pinned,
    isDeleted: m.is_deleted,
    readBy: m.readBy || [],
    createdAt: m.created_at,
    updatedAt: m.updated_at
  };
}

module.exports = { mapUser, mapChannel, mapMessage };
