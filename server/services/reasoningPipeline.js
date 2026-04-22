const embeddingService = require('./embeddingService');
const interventionAnalysisService = require('./interventionAnalysisService');
const featureExtractionService = require('./featureExtractionService');
const Patient = require('../models/Patient');
const DailyHealthLog = require('../models/DailyHealthLog');

const resolveStage = (patient) => {
  const explicit = String(patient?.dementiaSeverity || '').toLowerCase();
  if (['mild', 'moderate', 'severe'].includes(explicit)) return explicit;

  const state = String(patient?.currentState || '').toUpperCase();
  if (state === 'CRITICAL') return 'severe';
  if (state === 'ELEVATED_RISK') return 'moderate';
  return 'mild';
};

/**
 * LangGraph-style reasoning pipeline
 * Multi-step orchestration for cross-patient intelligence
 */

class ReasoningPipeline {
  constructor() {
    this.client = null;
    this.llmEnabled = false;

    try {
      // Lazy optional dependency: app should still run without Anthropic SDK.
      // eslint-disable-next-line global-require
      const { Anthropic } = require('@anthropic-ai/sdk');
      if (process.env.ANTHROPIC_API_KEY) {
        this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        this.llmEnabled = true;
      }
    } catch (_err) {
      this.client = null;
      this.llmEnabled = false;
    }
  }

  /**
   * Main reasoning flow
   */
  async generateRecommendations(patientId) {
    try {
      console.log(`[PIPELINE] Starting reasoning for patient ${patientId}`);

      // Step 1: Extract current state
      const currentState = await this.extractCurrentState(patientId);
      console.log(`[STEP 1] Current state extracted`);

      // Step 2: Find similar patients
      const similarPatients = await this.retrieveSimilarPatients(patientId);
      console.log(`[STEP 2] Found ${similarPatients.length} similar patients`);

      // Step 3: Check outcomes and interventions
      const interventionData = await this.checkOutcomeTrends(similarPatients);
      console.log(`[STEP 3] Analyzed intervention outcomes`);

      // Step 4: Filter by stage compatibility
      const compatibleInterventions = await this.filterByStageCompatibility(
        currentState.patient.dementiaSeverity,
        interventionData
      );
      console.log(`[STEP 4] Filtered ${compatibleInterventions.length} stage-compatible interventions`);

      // Step 5: Evaluate success rates
      const evaluatedInterventions = await this.evaluateSuccessRates(compatibleInterventions);
      console.log(`[STEP 5] Evaluated success rates`);

      // Step 6: Generate recommendations via LLM
      const recommendations = await this.generateLLMRecommendations(
        currentState,
        evaluatedInterventions,
        similarPatients
      );
      console.log(`[STEP 6] Generated LLM recommendations`);

      // Step 7: Apply confidence and safety filters
      const finalRecommendations = this.applySafetyFilters(recommendations);
      console.log(`[STEP 7] Applied safety filters`);

      return {
        patientId,
        currentState,
        similarPatients: similarPatients.slice(0, 5),
        recommendations: finalRecommendations,
        generatedAt: new Date()
      };
    } catch (err) {
      console.error('[PIPELINE] Error:', err.message);
      throw err;
    }
  }

  /**
   * Step 1: Extract current patient state
   */
  async extractCurrentState(patientId) {
    const patient = await Patient.findById(patientId);
    const features = await featureExtractionService.extractPatientFeatures(patientId, 14);

    // Get recent logs
    const recentLogs = await DailyHealthLog.find({ patientId })
      .sort({ date: -1 })
      .limit(7);

    return {
      patient: {
        id: patient._id,
        name: patient.name,
        age: patient.age,
        dementiaSeverity: resolveStage(patient),
        medications: patient.medications || []
      },
      features,
      recentLogs,
      problemStatement: this.createProblemStatement(features, recentLogs)
    };
  }

  /**
   * Create a human-readable problem statement
   */
  createProblemStatement(features, logs) {
    const topIssue = this.identifyTopIssue(features);
    const trend = features.raw.agitationTrend > 1 ? 'increasing' : 'decreasing';
    return `${topIssue}, with ${trend} trend over past 2 weeks`;
  }

  /**
   * Identify the primary health concern
   */
  identifyTopIssue(features) {
    const issues = [];
    if (features.raw.avgAgitation > 6) issues.push('high agitation');
    if (features.raw.avgSleep < 5) issues.push('poor sleep');
    if (features.raw.avgMood < 4) issues.push('low mood');
    if (features.raw.avgAppetite < 3) issues.push('poor appetite');
    if (features.raw.avgDailyExercise < 10) issues.push('low activity');

    return issues.length > 0 ? issues.join(', ') : 'stable condition';
  }

  /**
   * Step 2: Retrieve similar patients using embeddings
   */
  async retrieveSimilarPatients(patientId) {
    // Try embedding-based similarity first
    try {
      return await embeddingService.findSimilarPatients(patientId, 10);
    } catch (err) {
      console.warn('Embedding-based similarity failed, using trajectory-based:');
      return await embeddingService.findSimilarTrajectories(patientId);
    }
  }

  /**
   * Step 3: Check what worked for similar patients
   */
  async checkOutcomeTrends(similarPatients) {
    const data = [];

    for (const similar of similarPatients) {
      // Get intervention effects for this patient
      const InterventionEffect = require('../models/InterventionEffect');
      const effects = await InterventionEffect.find({
        patientId: similar.patientId,
        overallOutcome: { $in: ['positive', 'significantly_positive'] }
      })
      .sort({ confidence: -1 })
      .limit(5);

      data.push({
        patientId: similar.patientId,
        similarity: similar.similarity,
        successfulInterventions: effects
      });
    }

    return data;
  }

  /**
   * Step 4: Filter by stage compatibility
   */
  async filterByStageCompatibility(currentStage, interventionData) {
    const stageRules = {
      mild: {
        allowed: ['medication_change', 'activity_added', 'schedule_change'],
        complexity: 'high'
      },
      moderate: {
        allowed: ['medication_change', 'activity_added', 'environment_change'],
        complexity: 'medium'
      },
      severe: {
        allowed: ['medication_change', 'environment_change'],
        complexity: 'low'
      }
    };

    const rules = stageRules[currentStage] || stageRules.moderate;

    const compatible = [];
    for (const item of interventionData) {
      const filtered = item.successfulInterventions.filter(e =>
        rules.allowed.includes(e.interventionType)
      );

      if (filtered.length > 0) {
        compatible.push({
          ...item,
          successfulInterventions: filtered
        });
      }
    }

    return compatible;
  }

  /**
   * Step 5: Evaluate success rates
   */
  async evaluateSuccessRates(compatibleInterventions) {
    const evaluated = [];

    for (const item of compatibleInterventions) {
      for (const intervention of item.successfulInterventions) {
        const rate = await interventionAnalysisService.getInterventionSuccessRate(
          intervention.interventionType
        );

        evaluated.push({
          type: intervention.interventionType,
          description: intervention.description,
          effects: intervention.effects,
          confidence: intervention.confidence,
          successRate: rate?.successRate || 0,
          basedOnPatients: Math.floor(item.similarity * 10), // Rough estimate
          stage: resolveStage(intervention.patientId)
        });
      }
    }

    // Deduplicate and sort by confidence
    const unique = Array.from(
      new Map(evaluated.map(e => [e.type, e])).values()
    );

    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Step 6: Generate recommendations using Claude
   */
  async generateLLMRecommendations(currentState, evaluatedInterventions, similarPatients) {
    if (!this.llmEnabled || !this.client) {
      return this.generateRuleBasedRecommendations(evaluatedInterventions, similarPatients);
    }

    const interventionSummary = evaluatedInterventions
      .slice(0, 5)
      .map(
        e =>
          `- ${e.description}: ${e.successRate > 0.7 ? '✓ High success rate' : '◐ Moderate success'} (${(e.successRate * 100).toFixed(0)}%)`
      )
      .join('\n');

    const prompt = `You are a healthcare AI assisting with dementia care recommendations.

Patient Profile:
- Name: ${currentState.patient.name}
- Age: ${currentState.patient.age}
- Dementia Stage: ${currentState.patient.dementiaSeverity}
- Primary Issue: ${currentState.problemStatement}
- Current Medications: ${currentState.patient.medications.join(', ') || 'None listed'}

Recent Metrics (Last 2 weeks):
- Agitation Level: ${currentState.features.raw.avgAgitation.toFixed(1)}/10
- Sleep: ${currentState.features.raw.avgSleep.toFixed(1)} hours/night
- Mood: ${currentState.features.raw.avgMood.toFixed(1)}/10
- Activity: ${currentState.features.raw.avgDailyExercise.toFixed(0)} min/day
- Task Completion: ${(currentState.features.raw.taskCompletion * 100).toFixed(0)}%

What Worked for Similar Patients:
${interventionSummary}

Based on this data:
1. What ONE intervention would you recommend first?
2. Why specifically for this patient?
3. What should the caregiver watch for?
4. When should they reassess?

Keep response concise and actionable.`;

    const message = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    return [
      {
        recommendation: evaluatedInterventions[0]?.description || 'Monitor and reassess',
        reasoning: responseText,
        confidence: evaluatedInterventions[0]?.confidence || 0.5,
        successRate: evaluatedInterventions[0]?.successRate || 0,
        baselineType: 'primary'
      },
      ...(evaluatedInterventions.length > 1
        ? [
          {
            recommendation: evaluatedInterventions[1].description,
            reasoning: `Alternative based on ${evaluatedInterventions[1].confidence > 0.7 ? 'high' : 'moderate'} success rate`,
            confidence: evaluatedInterventions[1].confidence,
            successRate: evaluatedInterventions[1].successRate,
            baselineType: 'secondary'
          }
        ]
        : [])
    ];
  }

  generateRuleBasedRecommendations(evaluatedInterventions, similarPatients) {
    const primary = evaluatedInterventions[0];
    if (!primary) {
      return [
        {
          recommendation: 'Continue current routine and monitor for 7 days',
          reasoning: 'Not enough similar-case intervention outcomes are available yet. Continue tracking daily logs to improve recommendation quality.',
          confidence: 0.5,
          successRate: 0,
          basedOnPatients: similarPatients.length,
          baselineType: 'primary'
        }
      ];
    }

    const basedOn = Math.max(1, Math.floor((primary.successRate || 0) * 10));
    return [
      {
        recommendation: primary.description,
        reasoning: `Suggested from cross-patient outcomes with ${Math.round((primary.successRate || 0) * 100)}% observed success. Reassess in 7-14 days and capture caregiver feedback.`,
        confidence: primary.confidence || 0.6,
        successRate: primary.successRate || 0,
        basedOnPatients: basedOn,
        baselineType: 'primary'
      }
    ];
  }

  /**
   * Step 7: Apply safety and confidence filters
   */
  applySafetyFilters(recommendations) {
    return recommendations
      .filter(r => r.confidence >= 0.5) // Minimum confidence threshold
      .map(r => ({
        ...r,
        safetyLevel: r.confidence > 0.75 ? 'high' : r.confidence > 0.6 ? 'medium' : 'low',
        requiresCaregiverReview: r.confidence < 0.7
      }));
  }
}

module.exports = new ReasoningPipeline();
