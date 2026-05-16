import TrainingVideo from '../models/trainingVideo.model.js';

const WATCH_THRESHOLD = 0.9;

export function getWatchThresholdSeconds(durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return 1;
  return Math.max(1, Math.floor(durationSeconds * WATCH_THRESHOLD));
}

export function isWatchComplete(watchedSeconds, durationSeconds) {
  return watchedSeconds >= getWatchThresholdSeconds(durationSeconds);
}

export async function getActiveTrainingVideos() {
  return TrainingVideo.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
}

export function mergeTrainingProgress(videos, progressList = []) {
  const progressMap = new Map(
    progressList.map((p) => [String(p.trainingVideoId), p]),
  );

  return videos.map((video) => {
    const progress = progressMap.get(String(video._id));
    return {
      ...video,
      watchedSeconds: progress?.watchedSeconds ?? 0,
      completed: Boolean(progress?.completed),
      completedAt: progress?.completedAt ?? null,
    };
  });
}

export async function isDriverTrainingComplete(driver) {
  const activeVideos = await getActiveTrainingVideos();
  const required = activeVideos.filter((v) => v.isRequired);
  if (!required.length) return true;

  const progressMap = new Map(
    (driver.trainingProgress || []).map((p) => [String(p.trainingVideoId), p]),
  );

  return required.every((video) => {
    const progress = progressMap.get(String(video._id));
    return progress?.completed === true;
  });
}
