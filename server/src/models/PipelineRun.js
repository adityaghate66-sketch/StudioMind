const mongoose = require('mongoose')

const claimVerdictSchema = new mongoose.Schema(
  {
    claim: { type: String, required: true },
    type: { type: String, required: true },
    verdict: { type: String, enum: ['confirmed', 'disputed', 'unverifiable'], required: true },
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
    summary: { type: String, required: true },
    sources: [{ type: String }],
  },
  { _id: false }
)

const shotSchema = new mongoose.Schema(
  {
    shotNumber: { type: Number, required: true },
    framing: { type: String, required: true },
    description: { type: String, required: true },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
  },
  { _id: false }
)

const pipelineRunSchema = new mongoose.Schema(
  {
    brief: {
      type: String,
      required: [true, 'Brief is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'complete', 'failed'],
      default: 'pending',
    },
    agentStatus: {
      type: String,
      enum: ['screenplay', 'continuity', 'storyboard', ''],
      default: '',
    },
    sceneText: {
      type: String,
      default: '',
    },
    continuityClaims: [claimVerdictSchema],
    continuitySummary: {
      type: String,
      default: '',
    },
    continuityOverallRisk: {
      type: String,
      enum: ['low', 'medium', 'high', ''],
      default: '',
    },
    shots: [shotSchema],
    error: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
)

const PipelineRun = mongoose.model('PipelineRun', pipelineRunSchema)

module.exports = PipelineRun
