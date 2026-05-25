/**
 * Hard-coded ceiling constants mirrored from the backend so the UI can
 * disable / hint at limits proactively instead of waiting for a 400.
 *
 * Keep these in sync with the matching validations on the server
 * (e.g. `addCarService` enforces 5 cars per user).
 */

export const MAX_USER_CARS = 5;
export const MAX_SAVED_LOCATIONS = 20;
