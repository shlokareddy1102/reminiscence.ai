import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import './CaregiverDashboard.css';
import { API_BASE_URL } from '../config';

const CaregiverDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [persons, setPersons] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [newPerson, setNewPerson] = useState({ name: '', relationship: '', description: '' });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const fileInputRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user'));
  const socket = useRef(null);

  useEffect(() => {
    socket.current = io(API_BASE_URL);
    
    fetchPatients();

    // Listen for new alerts
    socket.current.on('new-alert', (alert) => {
      setAlerts(prev => [alert, ...prev]);
      
      // Show notification
      if (Notification.permission === 'granted') {
        new Notification('New Alert', { body: alert.message });
      }
    });

    // Request notification permission
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    return () => socket.current.disconnect();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/patients/caregiver/${user.id}`);
      setPatients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const selectPatient = async (patient) => {
    setSelectedPatient(patient);
    
    // Join patient's room for real-time updates
    socket.current.emit('join-patient-room', patient._id);
    
    // Fetch patient's persons
    const personsRes = await axios.get(`${API_BASE_URL}/api/persons/patient/${patient._id}`);
    setPersons(personsRes.data);
    
    // Fetch alerts
    const alertsRes = await axios.get(`${API_BASE_URL}/api/alerts/patient/${patient._id}`);
    setAlerts(alertsRes.data);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    setPhoto(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const addPerson = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', newPerson.name);
    formData.append('relationship', newPerson.relationship);
    formData.append('description', newPerson.description);
    formData.append('patientId', selectedPatient._id);
    if (photo) {
      formData.append('photo', photo);
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/persons`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setPersons([...persons, res.data]);
      
      // Reset form
      setNewPerson({ name: '', relationship: '', description: '' });
      setPhoto(null);
      setPhotoPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err) {
      console.error(err);
    }
  };

  const deletePerson = async (personId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/persons/${personId}`);
      setPersons(persons.filter(p => p._id !== personId));
    } catch (err) {
      console.error(err);
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await axios.put(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`);
      setAlerts(alerts.map(a => 
        a._id === alertId ? { ...a, acknowledged: true } : a
      ));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="caregiver-dashboard">
      <div className="sidebar">
        <h2>Your Patients</h2>
        <div className="patient-list">
          {patients.map(patient => (
            <div 
              key={patient._id} 
              className={`patient-item ${selectedPatient?._id === patient._id ? 'active' : ''}`}
              onClick={() => selectPatient(patient)}
            >
              <h3>{patient.name}</h3>
              <p>Status: {patient.status}</p>
              <p>Last active: {patient.lastActive ? new Date(patient.lastActive).toLocaleString() : 'Never'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        {selectedPatient ? (
          <>
            <h1>{selectedPatient.name}'s Dashboard</h1>
            
            <div className="alerts-section">
              <h2>Recent Alerts</h2>
              <div className="alerts-list">
                {alerts.slice(0, 10).map(alert => (
                  <div key={alert._id} className={`alert ${alert.acknowledged ? 'acknowledged' : ''}`}>
                    <p>{alert.message}</p>
                    <small>{new Date(alert.createdAt).toLocaleString()}</small>
                    {!alert.acknowledged && (
                      <button onClick={() => acknowledgeAlert(alert._id)}>
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="add-person-section">
              <h2>Add Person for Recognition</h2>
              <form onSubmit={addPerson}>
                <input
                  type="text"
                  placeholder="Name"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({...newPerson, name: e.target.value})}
                  required
                />
                <input
                  type="text"
                  placeholder="Relationship (e.g., son, daughter, nurse)"
                  value={newPerson.relationship}
                  onChange={(e) => setNewPerson({...newPerson, relationship: e.target.value})}
                  required
                />
                <textarea
                  placeholder="Description / Notes"
                  value={newPerson.description}
                  onChange={(e) => setNewPerson({...newPerson, description: e.target.value})}
                />
                
                <div className="photo-upload">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoChange}
                  />
                  {photoPreview && (
                    <img src={photoPreview} alt="Preview" className="photo-preview" />
                  )}
                </div>

                <button type="submit">Add Person</button>
              </form>
            </div>

            <div className="persons-section">
              <h2>Known People</h2>
              <div className="persons-grid">
                {persons.map(person => (
                  <div key={person._id} className="person-card">
                    {person.photo && <img src={person.photo} alt={person.name} />}
                    <h3>{person.name}</h3>
                    <p>{person.relationship}</p>
                    {person.description && <p>{person.description}</p>}
                    <button onClick={() => deletePerson(person._id)} className="delete-btn">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="select-patient-prompt">
            <h2>Select a patient to manage</h2>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaregiverDashboard;