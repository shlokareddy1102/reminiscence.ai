import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import Webcam from 'react-webcam';
import './PatientDashboard.css';
import { API_BASE_URL } from '../config';

const PatientDashboard = () => {
  const [persons, setPersons] = useState([]);
  const [lastDetected, setLastDetected] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const webcamRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));
  const socket = useRef(null);

  useEffect(() => {
    // Connect to socket
    socket.current = io(API_BASE_URL);
    
    // Get patient ID from user
    const fetchPatientData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/persons/patient/${user.patientId}`);
        setPersons(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchPatientData();

    // Listen for real-time updates
    socket.current.on('new-person-added', (person) => {
      setPersons(prev => [...prev, person]);
    });

    // Start face detection simulation
    const detectionInterval = setInterval(simulateFaceDetection, 5000);

    return () => {
      socket.current.disconnect();
      clearInterval(detectionInterval);
    };
  }, []);

  const simulateFaceDetection = () => {
    // Simulate random person detection (since we can't do real face recognition)
    if (persons.length > 0 && Math.random() > 0.5) {
      const randomPerson = persons[Math.floor(Math.random() * persons.length)];
      
      // Don't repeat same person within 10 seconds
      if (lastDetected?.id === randomPerson._id && 
          Date.now() - lastDetected.time < 10000) {
        return;
      }

      // Announce the person
      const message = getPersonalizedMessage(randomPerson);
      setAnnouncement(message);
      speak(message);
      
      setLastDetected({
        id: randomPerson._id,
        time: Date.now()
      });

      // Send alert to caregiver
      axios.post(`${API_BASE_URL}/api/alerts`, {
        patientId: user.patientId,
        type: 'person_detected',
        message: `${randomPerson.name} (${randomPerson.relationship}) detected`,
        data: { personId: randomPerson._id }
      });
    }
  };

  const getPersonalizedMessage = (person) => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : 
                    hour < 18 ? 'Good afternoon' : 'Good evening';
    
    return `${greeting}. This is ${person.name}, your ${person.relationship}.`;
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const captureAndIdentify = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      // In a real app, you'd send this to backend for processing
      simulateFaceDetection();
    }
  };

  return (
    <div className="patient-dashboard">
      <div className="camera-section">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          className="camera-feed"
        />
        <button onClick={captureAndIdentify} className="identify-btn">
          Identify Person
        </button>
      </div>

      <div className="info-section">
        {announcement && (
          <div className="announcement-banner">
            <h3>{announcement}</h3>
          </div>
        )}

        <div className="known-persons">
          <h2>People You Know</h2>
          <div className="persons-grid">
            {persons.map(person => (
              <div key={person._id} className="person-card">
                {person.photo && (
                  <img src={person.photo} alt={person.name} />
                )}
                <h3>{person.name}</h3>
                <p>{person.relationship}</p>
                {person.description && <p className="desc">{person.description}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;