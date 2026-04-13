const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, process.env.REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const register = async ({ username, email, password }) => {
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) throw new Error('Email or username already in use');

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email, password: hashed });
  return generateTokens(user._id);
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('Invalid credentials');

  return { ...generateTokens(user._id), user: { id: user._id, username: user.username, email } };
};

const refresh = (token) => {
  const payload = jwt.verify(token, process.env.REFRESH_SECRET);
  return generateTokens(payload.id);
};

module.exports = { register, login, refresh };