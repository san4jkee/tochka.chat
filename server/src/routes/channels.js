const express = require('express');
const Channels = require('../db/queries/channels');
const Messages = require('../db/queries/messages');
const Users = require('../db/queries/users');
const auth = require('../middleware/auth');
const { mapChannel, mapMessage, mapUser } = require('../db/mappers');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const channels = await Channels.findMemberChannels(req.userId);
    res.json({ channels: channels.map(mapChannel) });
  } catch (error) {
    console.error('GET /channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/public', auth, async (req, res) => {
  try {
    const channels = await Channels.findPublicChannels(req.userId);
    res.json({ channels: channels.map(mapChannel) });
  } catch (error) {
    console.error('GET /channels/public error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/join', auth, async (req, res) => {
  try {
    const channel = await Channels.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await Channels.addMember(channel.id, req.userId);
    channel.members = await Channels.getMembers(channel.id);
    channel.createdBy = await Channels.getCreator(channel.created_by);
    channel.mutedBy = await Channels.getMutedBy(channel.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channel.id}`).emit('channel-updated', {
        channelId: channel.id,
        members: channel.members.map(mapUser),
        memberCount: channel.members.length
      });
    }

    res.json({ channel: mapChannel(channel) });
  } catch (error) {
    console.error('POST /channels/:id/join error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/direct/:userId', auth, async (req, res) => {
  try {
    console.log('POST /direct/:userId - userId:', req.params.userId, 'currentUserId:', req.userId);
    const targetUser = await Users.findById(req.params.userId);
    if (!targetUser) {
      console.log('POST /direct/:userId - target user not found');
      return res.status(404).json({ error: 'User not found' });
    }

    let channel = await Channels.findDirectChannel(req.userId, req.params.userId);
    console.log('POST /direct/:userId - existing channel:', channel?.id);

    if (!channel) {
      console.log('POST /direct/:userId - creating new channel');
      const created = await Channels.create(
        {
          name: targetUser.display_name,
          type: 'direct',
          created_by: req.userId
        },
        [req.userId, req.params.userId]
      );
      channel = await Channels.findById(created.id);
    }

    channel.members = await Channels.getMembers(channel.id);
    channel.createdBy = await Channels.getCreator(channel.created_by);
    channel.mutedBy = await Channels.getMutedBy(channel.id);

    const mappedChannel = mapChannel(channel);
    console.log('POST /direct/:userId - response channel id:', mappedChannel._id);
    res.json({ channel: mappedChannel });
  } catch (error) {
    console.error('POST /channels/direct/:userId error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, description, type, memberIds, avatar } = req.body;

    let members = [req.userId];
    if (memberIds && memberIds.length > 0) {
      members = [...new Set([...members, ...memberIds])];
    }

    const created = await Channels.create(
      {
        name,
        description: description || '',
        avatar: avatar || '',
        type: type || 'public',
        created_by: req.userId
      },
      members
    );

    const channel = await Channels.findById(created.id);
    channel.members = await Channels.getMembers(channel.id);
    channel.createdBy = await Channels.getCreator(channel.created_by);

    res.status(201).json({ channel: mapChannel(channel) });
  } catch (error) {
    console.error('POST /channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const channel = await Channels.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = await Channels.isMember(channel.id, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    channel.members = await Channels.getMembers(channel.id);
    channel.createdBy = await Channels.getCreator(channel.created_by);
    channel.mutedBy = await Channels.getMutedBy(channel.id);

    res.json({ channel: mapChannel(channel) });
  } catch (error) {
    console.error('GET /channels/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, avatar, type } = req.body;
    const channel = await Channels.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.created_by !== req.userId) {
      return res.status(403).json({ error: 'Только создатель может редактировать канал' });
    }

    const update = {};
    if (name) update.name = name;
    if (description !== undefined) update.description = description;
    if (avatar !== undefined) update.avatar = avatar;
    if (type && ['public', 'private'].includes(type)) update.type = type;

    await Channels.updateById(channel.id, update);
    const updated = await Channels.findById(channel.id);
    updated.members = await Channels.getMembers(updated.id);
    updated.createdBy = await Channels.getCreator(updated.created_by);

    res.json({ channel: mapChannel(updated) });
  } catch (error) {
    console.error('PUT /channels/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const channel = await Channels.findById(req.params.id);

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = await Channels.isMember(channel.id, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Channels.addMember(channel.id, userId);
    const members = await Channels.getMembers(channel.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channel.id}`).emit('channel-updated', {
        channelId: channel.id,
        members: members.map(mapUser),
        memberCount: members.length
      });
    }

    res.json({ channel: mapChannel({ ...channel, members }) });
  } catch (error) {
    console.error('POST /channels/:id/members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const channel = await Channels.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    await Channels.removeMember(channel.id, req.params.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /channels/:id/members/:userId error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/invite', auth, async (req, res) => {
  try {
    const { userId } = req.body;
    const channel = await Channels.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = await Channels.isMember(channel.id, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const targetUser = await Users.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const alreadyMember = await Channels.isMember(channel.id, userId);
    if (alreadyMember) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    let dmChannel = await Channels.findDirectChannel(req.userId, userId);

    if (!dmChannel) {
      const created = await Channels.create(
        {
          name: targetUser.display_name,
          type: 'direct',
          created_by: req.userId
        },
        [req.userId, userId]
      );
      dmChannel = await Channels.findById(created.id);
    }

    const invitationMessage = await Messages.create({
      channel_id: dmChannel.id,
      sender_id: req.userId,
      content: `Приглашаю вас вступить в канал «${channel.name}» [channel:${channel.id}]`,
      type: 'text',
      attachments: []
    }, [userId]);

    await Channels.updateLastMessage(dmChannel.id, invitationMessage.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${dmChannel.id}`).emit('new-message', { message: mapMessage(invitationMessage) });
    }

    res.json({ success: true, message: mapMessage(invitationMessage) });
  } catch (error) {
    console.error('POST /channels/:id/invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/mute', auth, async (req, res) => {
  try {
    const channel = await Channels.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = await Channels.isMember(channel.id, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const isMuted = await Channels.toggleMute(channel.id, req.userId);

    res.json({ muted: isMuted });
  } catch (error) {
    console.error('POST /channels/:id/mute error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/pin', auth, async (req, res) => {
  try {
    const channel = await Channels.findById(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = await Channels.isMember(channel.id, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await Channels.togglePin(channel.id, req.userId);

    res.json({ pinned: result.pinned, pinnedAt: result.pinnedAt });
  } catch (error) {
    console.error('POST /channels/:id/pin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
