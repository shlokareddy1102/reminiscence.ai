import { Navigate, Route, Routes } from 'react-router-dom';
import PatientScreen from './patient/PatientScreen';
import CaregiverDashboard from './caregiver/CaregiverDashboard';

const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/patient" replace />} />
    <Route path="/patient" element={<PatientScreen />} />
    <Route path="/caregiver" element={<CaregiverDashboard />} />
    <Route path="*" element={<Navigate to="/patient" replace />} />
  </Routes>
);

export default App;
