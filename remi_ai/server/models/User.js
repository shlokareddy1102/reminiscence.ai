const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, trim: true },
  dob: { type: String, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['caregiver', 'patient'], required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);