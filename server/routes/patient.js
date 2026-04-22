const router = require('express').Router();
const Patient = require('../models/Patient');
const { authenticateToken } = require('../middleware/auth');
const { ensureCaregiverDemoCohort } = require('../services/demoCohortService');

router.get('/list', authenticateToken, async (req, res) => {
  try {
    // If caregiver, filter by caregiverIds
    if (req.userRole === 'caregiver') {
      await ensureCaregiverDemoCohort({ _id: req.userId, name: req.user?.name || 'Caregiver' });

      const patients = await Patient.find({ caregiverIds: req.userId })
        .sort({ createdAt: 1 })
        .lean();

      return res.json(patients);
    }

    // If patient, return their own patient record
    if (req.userRole === 'patient') {
      const patients = await Patient.find({}).sort({ createdAt: 1 }).lean();
      return res.json(patients);
    }

    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findOne().sort({ createdAt: 1 });
    if (!patient) return res.status(404).json({ message: 'No patient found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:patientId', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add patient to caregiver using invite code
router.post('/add-by-code', authenticateToken, async (req, res) => {
  try {
    if (req.userRole !== 'caregiver') {
      return res.status(403).json({ msg: 'Only caregivers can add patients' });
    }

    const { inviteCode } = req.body;
    
    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ msg: 'Invite code is required' });
    }

    const normalizedCode = inviteCode.trim().toUpperCase();
    const patient = await Patient.findOne({ inviteCode: normalizedCode });

    if (!patient) {
      return res.status(404).json({ msg: 'Invalid invite code' });
    }

    // Check if code is still valid
    if (!patient.isInviteCodeValid()) {
      return res.status(400).json({ msg: 'Invite code has expired. Please ask the patient for a new code.' });
    }

    // Check if caregiver is already linked
    if (patient.caregiverIds.includes(req.userId)) {
      return res.status(400).json({ msg: 'You are already linked to this patient' });
    }

    // Add caregiver ID to patient
    patient.caregiverIds.push(req.userId);
    await patient.save();

    res.json({ 
      msg: 'Patient added successfully',
      patient: {
        _id: patient._id,
        name: patient.name,
        age: patient.age,
        currentState: patient.currentState
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get patient's own invite code (for patients to share)
router.get('/invite-code/view', authenticateToken, async (req, res) => {
  try {
    if (req.userRole !== 'patient') {
      return res.status(403).json({ msg: 'Only patients can view their invite code' });
    }

    const User = require('../models/User');
    
    // Find user and get their patient ID
    const user = await User.findById(req.userId);
    if (!user || !user.patientId) {
      return res.status(404).json({ msg: 'Patient record not found' });
    }

    // Get the patient record
    let patient = await Patient.findById(user.patientId);
    
    if (!patient) {
      return res.status(404).json({ msg: 'Patient record not found' });
    }

    // Regenerate code if expired
    if (!patient.isInviteCodeValid()) {
      patient.generateInviteCode();
      await patient.save();
    }

    res.json({
      inviteCode: patient.inviteCode,
      expiresAt: patient.inviteCodeExpiresAt,
      message: 'Share this code with your caregiver'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Regenerate invite code (for patients)
router.post('/invite-code/regenerate', authenticateToken, async (req, res) => {
  try {
    if (req.userRole !== 'patient') {
      return res.status(403).json({ msg: 'Only patients can regenerate their invite code' });
    }

    const User = require('../models/User');
    
    // Find user and get their patient ID
    const user = await User.findById(req.userId);
    if (!user || !user.patientId) {
      return res.status(404).json({ msg: 'Patient record not found' });
    }

    let patient = await Patient.findById(user.patientId);
    
    if (!patient) {
      return res.status(404).json({ msg: 'Patient record not found' });
    }

    const newCode = patient.generateInviteCode();
    await patient.save();

    res.json({
      inviteCode: newCode,
      expiresAt: patient.inviteCodeExpiresAt,
      message: 'New invite code generated'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
