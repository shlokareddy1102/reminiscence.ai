const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Patient = require('../models/Patient');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your_jwt_secret') {
  throw new Error('JWT_SECRET is required. Set it in your .env file before starting the server.');
}
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/;
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const classifyPasswordStrength = (password = '') => {
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const complexityCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (password.length >= 12 && complexityCount === 4) return 'Hard';
  if (password.length >= 8 && complexityCount >= 3) return 'Medium';
  return 'Easy';
};

const getDobVariants = (dob) => {
  if (!dob) return [];

  const raw = String(dob).trim();
  if (!raw) return [];

  const compact = raw.replace(/\D/g, '');
  const variants = new Set([raw, compact]);

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const year = String(parsed.getUTCFullYear());
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    variants.add(`${year}-${month}-${day}`);
    variants.add(`${year}${month}${day}`);
  }

  return Array.from(variants).map((value) => value.toLowerCase());
};

const getAgeFromDob = (dob) => {
  const parsed = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  const dayDiff = now.getDate() - parsed.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, caregiverId, username, dob } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedName = String(name || '').trim();
    const normalizedUsername = (username || email?.split('@')[0] || name || '').trim().toLowerCase();
    const normalizedPassword = String(password || '').trim();
    const normalizedDob = String(dob || '').trim();

    if (!normalizedName) {
      return res.status(400).json({ msg: 'Name is required' });
    }

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ msg: 'Please provide a valid email address' });
    }

    if (!['patient', 'caregiver'].includes(String(role || '').toLowerCase())) {
      return res.status(400).json({ msg: 'Role must be either patient or caregiver' });
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      return res.status(400).json({ msg: 'Username must be 3-30 chars and use lowercase letters, numbers, dot, underscore, or hyphen' });
    }

    if (!DOB_REGEX.test(normalizedDob)) {
      return res.status(400).json({ msg: 'Date of birth must use YYYY-MM-DD format' });
    }

    const age = getAgeFromDob(normalizedDob);
    if (age == null) {
      return res.status(400).json({ msg: 'Date of birth is invalid' });
    }

    if (age < 18) {
      return res.status(400).json({ msg: 'You must be at least 18 years old to create an account' });
    }

    if (normalizedUsername && normalizedPassword.toLowerCase() === normalizedUsername) {
      return res.status(400).json({ msg: 'Password must not match username' });
    }

    const dobVariants = getDobVariants(normalizedDob);
    if (dobVariants.includes(normalizedPassword.toLowerCase())) {
      return res.status(400).json({ msg: 'Password must not match date of birth' });
    }

    if (!PASSWORD_REGEX.test(normalizedPassword)) {
      return res.status(400).json({
        msg: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      });
    }

    const passwordStrength = classifyPasswordStrength(normalizedPassword);
    
    // Check if user exists
    let user = await User.findOne({ email: normalizedEmail });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    // Create new user
    user = new User({
      name: normalizedName,
      email: normalizedEmail,
      password: await bcrypt.hash(normalizedPassword, 10),
      role: String(role).toLowerCase(),
      username: normalizedUsername || undefined,
      dob: normalizedDob || undefined
    });

    await user.save();

    // If patient, create patient record
    if (String(role).toLowerCase() === 'patient' && caregiverId) {
      const patient = new Patient({
        userId: user._id,
        caregiverId,
        name: normalizedName
      });
      await patient.save();
      
      user.patientId = patient._id;
      await user.save();
    }

    // Create token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        patientId: user.patientId || null,
        passwordStrength
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPassword = String(password || '');

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ msg: 'Please provide a valid email address' });
    }

    if (!normalizedPassword) {
      return res.status(400).json({ msg: 'Password is required' });
    }
    
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(normalizedPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        patientId: user.patientId || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;