const router = require('express').Router();
const multer = require('multer');
const axios = require('axios');
const KnownPerson = require('../models/KnownPerson');
const Event = require('../models/Event');
const ActivityLog = require('../models/ActivityLog');

const upload = multer({ storage: multer.memoryStorage() });

// Python service configuration
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5002';

/**
 * Rebuild FAISS index in Python service with all known people.
 * Call this after adding/removing people to keep index in sync.
 */
async function rebuildPythonIndex(patientId = null) {
  try {
    const query = patientId ? { patientId } : {};
    const people = await KnownPerson.find(query);
    
    const formattedPeople = people.map(p => ({
      id: p._id.toString(),
      name: p.name,
      relationship: p.relationship,
      notes: p.notes || '',
      photo: p.photo
    }));
    
    const response = await axios.post(`${PYTHON_SERVICE_URL}/rebuild-index`, {
      people: formattedPeople
    }, {
      timeout: 30000  // 30 second timeout for large datasets
    });
    
    console.log(`✓ Python index rebuilt: ${response.data.message}`);
    return response.data;
  } catch (error) {
    console.error('✗ Failed to rebuild Python index:', error.message);
    // Don't throw - we want the main operation to succeed even if Python service is down
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const patientId = req.query.patientId;
    const query = patientId ? { patientId } : {};
    const people = await KnownPerson.find(query).sort({ name: 1 });
    res.json(people);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { patientId, name, relationship, notes = '' } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Photo is required' });
    }

    const photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const person = await KnownPerson.create({
      patientId,
      name,
      relationship,
      notes,
      photo
    });

    const event = await Event.create({
      patientId,
      eventType: 'known_person_added',
      category: 'interaction',
      riskLevel: 'LOW',
      metadata: {
        personId: person._id,
        name: person.name,
        relationship: person.relationship
      }
    });

    const io = req.app.get('io');
    io.to(`caregiver-${patientId}`).emit('knownPersonAdded', person);
    io.to(`caregiver-${patientId}`).emit('eventCreated', event);

    // Rebuild Python FAISS index with new person
    rebuildPythonIndex(patientId);

    res.status(201).json(person);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/mark-visited', async (req, res) => {
  try {
    const person = await KnownPerson.findById(req.params.id);

    if (!person) {
      return res.status(404).json({ message: 'Known person not found' });
    }

    person.lastVisitedTime = new Date();
    person.visitCount += 1;
    await person.save();

    await ActivityLog.create({
      patientId: person.patientId,
      interactionType: 'face_detected'
    });

    const event = await Event.create({
      patientId: person.patientId,
      eventType: 'known_person_recognized',
      category: 'interaction',
      riskLevel: 'LOW',
      metadata: {
        personId: person._id,
        name: person.name,
        relationship: person.relationship,
        lastVisitedTime: person.lastVisitedTime,
        visitCount: person.visitCount
      }
    });

    const io = req.app.get('io');
    io.to(`caregiver-${person.patientId}`).emit('knownPersonSeen', person);
    io.to(`caregiver-${person.patientId}`).emit('eventCreated', event);

    res.json(person);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const person = await KnownPerson.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: 'Known person not found' });
    }
    
    const patientId = person.patientId;
    await KnownPerson.findByIdAndDelete(req.params.id);
    
    // Rebuild Python FAISS index after deletion
    rebuildPythonIndex(patientId);
    
    res.json({ message: 'Known person removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual index rebuild endpoint
router.post('/rebuild-index', async (req, res) => {
  try {
    const { patientId } = req.body;
    const result = await rebuildPythonIndex(patientId);
    
    if (result) {
      res.json({ success: true, data: result });
    } else {
      res.status(503).json({ 
        success: false, 
        message: 'Python service unavailable' 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Report unknown face detection
router.post('/report-unknown', async (req, res) => {
  try {
    const { patientId, faceImage } = req.body;
    
    console.log('🚨 Unknown person detection received for patient:', patientId);
    
    if (!patientId || !faceImage) {
      return res.status(400).json({ error: 'patientId and faceImage are required' });
    }

    const event = await Event.create({
      patientId,
      eventType: 'unknown_person_detected',
      category: 'interaction',
      riskLevel: 'MEDIUM',
      metadata: {
        timestamp: new Date(),
        faceImage: faceImage
      }
    });

    const io = req.app.get('io');
    const room = `caregiver-${patientId}`;
    console.log(`📡 Emitting unknownPersonDetected to room: ${room}`);
    io.to(room).emit('unknownPersonDetected', {
      event,
      faceImage
    });

    res.json({ success: true, event });
  } catch (error) {
    console.error('✗ Error in report-unknown:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add unknown person to known people list with captured face image
router.post('/add-from-detection', async (req, res) => {
  try {
    const { patientId, name, relationship, faceImage } = req.body;
    
    console.log('✨ Adding detected person to known people for patient:', patientId);
    
    if (!patientId || !name || !relationship || !faceImage) {
      return res.status(400).json({ error: 'patientId, name, relationship, and faceImage are required' });
    }

    // Create the known person with the captured face image
    const person = await KnownPerson.create({
      patientId,
      name,
      relationship,
      notes: 'Added from detection',
      photo: faceImage
    });

    // Create event to log this action
    const event = await Event.create({
      patientId,
      eventType: 'known_person_added',
      category: 'interaction',
      riskLevel: 'LOW',
      metadata: {
        personId: person._id,
        name: person.name,
        relationship: person.relationship,
        addedFrom: 'detection'
      }
    });

    const io = req.app.get('io');
    const room = `caregiver-${patientId}`;
    
    // Notify caregiver that person was added
    io.to(room).emit('knownPersonAdded', person);
    io.to(room).emit('eventCreated', event);

    // Rebuild Python FAISS index with new person
    rebuildPythonIndex(patientId);

    console.log(`✓ Person ${name} added to known people`);
    res.status(201).json({ success: true, person, event });
  } catch (error) {
    console.error('✗ Error in add-from-detection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Recognize face endpoint - proxy to Python service
router.post('/recognize', async (req, res) => {
  try {
    const { image, top_k = 1, threshold = 0.6 } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }
    
    const response = await axios.post(`${PYTHON_SERVICE_URL}/recognize`, {
      image,
      top_k,
      threshold
    }, {
      timeout: 5000  // 5 second timeout for recognition
    });
    
    res.json(response.data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Python service unavailable',
        matches: [],
        found: false
      });
    } else {
      res.status(500).json({ 
        error: error.message,
        matches: [],
        found: false
      });
    }
  }
});

module.exports = router;
