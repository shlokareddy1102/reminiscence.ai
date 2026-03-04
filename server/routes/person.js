const router = require('express').Router();
const Person = require('../models/Person');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Get all persons for a patient
router.get('/patient/:patientId', async (req, res) => {
  try {
    const persons = await Person.find({ patientId: req.params.patientId });
    res.json(persons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new person with photo
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { name, relationship, patientId, description, importance } = req.body;
    
    // Convert photo to base64 if exists
    let photoBase64 = null;
    if (req.file) {
      photoBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const person = new Person({
      patientId,
      name,
      relationship,
      photo: photoBase64,
      description,
      importance: importance || 5
    });

    await person.save();

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`patient-${patientId}`).emit('new-person-added', person);

    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update person
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const updates = { ...req.body };
    
    if (req.file) {
      updates.photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const person = await Person.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );

    res.json(person);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete person
router.delete('/:id', async (req, res) => {
  try {
    await Person.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Person deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;