const express = require('express');
const Messages = require('../db/queries/messages');
const Channels = require('../db/queries/channels');
const auth = require('../middleware/auth');
const { mapMessage } = require('../db/mappers');

const router = express.Router();

router.get('/:channelId', auth, async (req, res) => {
  try {
    const { before, limit } = req.query;
    const messages = await Messages.findByChannel(req.params.channelId, {
      before,
      limit: limit ? parseInt(limit) : 50
    });

    res.json({ messages: messages.map(mapMessage) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:channelId', auth, async (req, res) => {
  try {
    const { content, type, attachments, replyTo, mentions, poll } = req.body;

    const channel = await Channels.findById(req.params.channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = await Channels.isMember(channel.id, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const message = await Messages.create({
      channel_id: req.params.channelId,
      sender_id: req.userId,
      content,
      type: type || 'text',
      attachments: attachments || [],
      reply_to: replyTo || null,
      poll: poll || null
    }, mentions || []);

    await Channels.updateLastMessage(channel.id, message.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${req.params.channelId}`).emit('new-message', { message: mapMessage(message) });
    }

    res.status(201).json({ message: mapMessage(message) });
  } catch (error) {
    console.error('POST /messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  console.log('PUT /messages/:id called, id:', req.params.id, 'body:', req.body, 'userId:', req.userId);
  try {
    const { content } = req.body;
    const message = await Messages.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== req.userId) {
      console.log('Permission denied: sender_id:', message.sender_id, 'userId:', req.userId);
      return res.status(403).json({ error: 'Can only edit own messages' });
    }

    const updated = await Messages.updateById(message.id, {
      content,
      is_edited: true
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${message.channel_id}`).emit('message-updated', { message: mapMessage(updated) });
    }

    res.json({ message: mapMessage(updated) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Messages.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== req.userId) {
      return res.status(403).json({ error: 'Can only delete own messages' });
    }

    await Messages.softDelete(message.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${message.channel_id}`).emit('message-deleted', { messageId: message.id });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/reactions', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const message = await Messages.findByIdWithSender(req.params.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const reactions = await Messages.addReaction(message.id, emoji, req.userId);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${message.channel_id}`).emit('message-updated', {
        message: mapMessage({ ...message, reactions })
      });
    }

    res.json({ message: mapMessage({ ...message, reactions }) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search/:channelId', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const messages = await Messages.search(req.params.channelId, q);
    res.json({ messages: messages.map(mapMessage) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/poll/vote', auth, async (req, res) => {
  try {
    const { optionIndex, customOption } = req.body;
    const message = await Messages.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.type !== 'poll') {
      return res.status(400).json({ error: 'Not a poll' });
    }

    let poll = message.poll;
    let voteIndex = optionIndex;

    if (customOption && poll.allowCustom) {
      poll = { ...poll, options: [...poll.options, customOption] };
      voteIndex = poll.options.length - 1;
      const db = require('../db');
      await db('messages').where('id', message.id).update({ poll: JSON.stringify(poll) });
      message.poll = poll;
    }

    const votes = await Messages.votePoll(message.id, req.userId, voteIndex);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${message.channel_id}`).emit('message-updated', {
        message: mapMessage({ ...message, pollVotes: votes })
      });
    }

    res.json({ votes, poll });
  } catch (error) {
    console.error('Poll vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/poll', auth, async (req, res) => {
  try {
    const { question, options, anonymous, multiple, allowCustom, lockVotes } = req.body;
    const message = await Messages.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== req.userId) {
      return res.status(403).json({ error: 'Только создатель может редактировать опрос' });
    }

    if (message.type !== 'poll') {
      return res.status(400).json({ error: 'Not a poll' });
    }

    const db = require('../db');
    const updatedPoll = {
      ...message.poll,
      ...(question !== undefined && { question }),
      ...(options !== undefined && { options }),
      ...(anonymous !== undefined && { anonymous }),
      ...(multiple !== undefined && { multiple }),
      ...(allowCustom !== undefined && { allowCustom }),
      ...(lockVotes !== undefined && { lockVotes })
    };

    await db('messages').where('id', message.id).update({ poll: JSON.stringify(updatedPoll), is_edited: true });
    const updated = await Messages.findById(message.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${message.channel_id}`).emit('message-updated', {
        message: mapMessage(updated)
      });
    }

    res.json({ message: mapMessage(updated) });
  } catch (error) {
    console.error('Poll edit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:channelId/forward', auth, async (req, res) => {
  try {
    const { messageId } = req.body;

    const originalMessage = await Messages.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ error: 'Original message not found' });
    }

    const originalChannel = await Channels.findById(originalMessage.channel_id);
    const channel = await Channels.findById(req.params.channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const isMember = await Channels.isMember(channel.id, req.userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const channelName = originalChannel?.name || 'Неизвестный канал';

    const newMessage = await Messages.create({
      channel_id: req.params.channelId,
      sender_id: req.userId,
      content: originalMessage.content,
      type: originalMessage.type,
      attachments: originalMessage.attachments,
      forwarded_from: channelName,
      forwarded_from_channel: originalMessage.channel_id,
      forwarded_from_message: originalMessage.id
    });

    await Channels.updateLastMessage(channel.id, newMessage.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${req.params.channelId}`).emit('new-message', { message: mapMessage(newMessage) });
    }

    res.status(201).json({ message: mapMessage(newMessage) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
