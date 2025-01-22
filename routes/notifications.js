const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  link: { type: String }, // URL to view more details
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

module.exports = mongoose.model('Notification', notificationSchema);
