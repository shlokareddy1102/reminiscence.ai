const mongoose = require('mongoose');

const WebsiteSessionSchema = new mongoose.Schema({
  clientId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  role: { type: String, enum: ['caregiver', 'patient', 'guest'], default: 'guest' },
  pagePath: { type: String, default: '/' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('WebsiteSession', WebsiteSessionSchema);
