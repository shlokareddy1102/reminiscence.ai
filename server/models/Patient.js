const mongoose = require('mongoose');

const CaregiverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  role: { type: String, enum: ['family', 'medical'], required: true },
  priorityLevel: { type: Number, default: 1 }
}, { _id: false });

const PatientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Number, required: true },
  riskScore: { type: Number, default: 0 },
  currentState: {
    type: String,
    enum: ['STABLE', 'MILD_RISK', 'ELEVATED_RISK', 'CRITICAL'],
    default: 'STABLE'
  },
  lastActivityTime: { type: Date, default: Date.now },
  caregivers: { type: [CaregiverSchema], default: [] },
  caregiverIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  inviteCode: { type: String, unique: true, sparse: true, index: true },
  inviteCodeExpiresAt: { type: Date },
  invitedEmails: [{ type: String }]
}, { timestamps: true });

// Generate unique invite code
const generateInviteCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

PatientSchema.methods.generateInviteCode = function() {
  this.inviteCode = generateInviteCode();
  this.inviteCodeExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return this.inviteCode;
};

PatientSchema.methods.isInviteCodeValid = function() {
  if (!this.inviteCode) return false;
  if (this.inviteCodeExpiresAt && new Date() > this.inviteCodeExpiresAt) return false;
  return true;
};

PatientSchema.pre('save', async function() {
  // Generate invite code on first create if not present
  if (this.isNew && !this.inviteCode) {
    this.generateInviteCode();
  }
});

module.exports = mongoose.model('Patient', PatientSchema);