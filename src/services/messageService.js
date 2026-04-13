const Message = require('../models/Message');

const sendMessage = async ({ roomId, senderId, content, type = 'text', fileUrl }) => {
  const message = await Message.create({ roomId, sender: senderId, content, type, fileUrl });
  return message.populate('sender', 'username avatar');
};

// cursor-based pagination — much better than page-based for chat
const getMessages = async (roomId, cursor, limit = 30) => {
  const query = { roomId, deletedAt: null };

  if (cursor) {
    query._id = { $lt: cursor };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('sender', 'username avatar');

  const nextCursor = messages.length === limit ? messages[messages.length - 1]._id : null;
  return { messages: messages.reverse(), nextCursor };
};

const deleteMessage = async (messageId, userId) => {
  const msg = await Message.findById(messageId);
  if (!msg) throw new Error('Message not found');
  if (msg.sender.toString() !== userId.toString()) throw new Error('Unauthorized');

  msg.deletedAt = new Date();
  await msg.save();
  return msg;
};

module.exports = { sendMessage, getMessages, deleteMessage };