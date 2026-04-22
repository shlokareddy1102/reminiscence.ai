const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  reportType: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  generatedAt: { type: Date, default: Date.now },
  
  // Metrics
  totalAlerts: { type: Number, default: 0 },
  highRiskAlerts: { type: Number, default: 0 },
  totalEvents: { type: Number, default: 0 },
  averageRiskScore: { type: Number, default: 0 },
  stateChanges: [String], // Array of state changes during period
  
  // Deterioration analysis
  riskTrend: { type: String, enum: ['improving', 'stable', 'declining'], default: 'stable' },
  deteriorationRate: { type: Number, default: 0 }, // Percentage change
  
  // Summary
  summary: { type: String, default: '' },
  recommendations: [String],

  // ML metadata for explainability in UI
  mlAssessment: {
    riskScore: { type: Number, default: null },
    riskLevel: { type: String, default: null },
    source: { type: String, default: null },
    anomaly: {
      isAnomaly: { type: Boolean, default: null },
      anomalyScore: { type: Number, default: null }
    }
  },
  
  // File reference
  pdfPath: { type: String, default: null },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
