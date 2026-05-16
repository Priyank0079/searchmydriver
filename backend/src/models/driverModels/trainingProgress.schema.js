import mongoose from 'mongoose';

const trainingProgressSchema = new mongoose.Schema(
  {
    trainingVideoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingVideo',
      required: true,
    },
    watchedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

export default trainingProgressSchema;
