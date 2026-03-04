const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    socket.on('join-caregiver-room', (patientId) => {
      socket.join(`caregiver-${patientId}`);
    });

    socket.on('join-patient-room', (patientId) => {
      socket.join(`patient-${patientId}`);
    });
  });
};

module.exports = registerSocketHandlers;
