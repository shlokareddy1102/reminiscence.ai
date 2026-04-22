const router = require('express').Router();
const axios = require('axios');
const multer = require('multer');
const KnownPerson = require('../models/KnownPerson');
const Event = require('../models/Event');
const ActivityLog = require('../models/ActivityLog');
const Alert = require('../models/Alert');
const { rebuildPythonIndex } = require('../services/faceIndexService');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

const upload = multer({ storage: multer.memoryStorage() });

const resolvePhotoData = (req) => {
  if (req.file) {
    return `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }

  const rawPhoto = String(req.body?.photoData || '').trim();
  return rawPhoto || '';
};

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

    const uploadedPhoto = resolvePhotoData(req);

    if (!uploadedPhoto) {
      return res.status(400).json({ message: 'Photo is required' });
    }

    const person = await KnownPerson.create({
      patientId,
      name,
      relationship,
      notes,
      photo: uploadedPhoto,
      photos: [uploadedPhoto]
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

router.post('/:id/photos', upload.single('photo'), async (req, res) => {
  try {
    const person = await KnownPerson.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: 'Known person not found' });
    }

    const photoData = resolvePhotoData(req);
    if (!photoData) {
      return res.status(400).json({ message: 'Photo is required' });
    }

    person.photos = Array.isArray(person.photos) ? person.photos : [];
    person.photos.push(photoData);
    if (!person.photo) {
      person.photo = photoData;
    }
    await person.save();

    rebuildPythonIndex(person.patientId);
    res.status(201).json(person);
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

    const alert = await Alert.create({
      patientId,
      message: 'Unknown face detected by patient camera',
      riskLevel: 'MEDIUM'
    });

    const io = req.app.get('io');
    const room = `caregiver-${patientId}`;
    console.log(`📡 Emitting unknownPersonDetected to room: ${room}`);
    io.to(room).emit('unknownPersonDetected', {
      event,
      faceImage
    });
    io.to(room).emit('alertGenerated', alert);

    res.json({ success: true, event, alert });
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
      photo: faceImage,
      photos: [faceImage]
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
      timeout: 20000  // Allow model warm-up / slow CPU inference
    });
    
    res.json(response.data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        error: 'Python service unavailable',
        matches: [],
        found: false
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(504).json({
        error: 'Face recognition timed out. Python service is running but too slow or still warming up.',
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
