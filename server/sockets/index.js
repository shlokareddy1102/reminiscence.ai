const registerSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id);
    
    socket.on('join-caregiver-room', (patientId) => {
      const room = `caregiver-${patientId}`;
      socket.join(room);
      console.log(`👨‍⚕️ Caregiver joined room: ${room} (socket: ${socket.id})`);
    });

    socket.on('join-patient-room', (patientId) => {
      const room = `patient-${patientId}`;
      socket.join(room);
      console.log(`👤 Patient joined room: ${room} (socket: ${socket.id})`);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected:', socket.id);
    });
  });
};

module.exports = registerSocketHandlers;
