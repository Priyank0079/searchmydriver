/** Read a user's saved answer for a platform condition. */
export const getConditionAnswer = (userConditions, conditionId) => {
  const match = userConditions?.find(
    (uc) => String(uc.conditionId?._id ?? uc.conditionId) === String(conditionId),
  );
  const v = match?.value;
  return v === true || v === false ? v : null;
};

export const buildConditionPayload = (conditions, answers) =>
  conditions.map((c) => ({
    conditionId: c._id,
    value: answers[c._id] ?? null,
  }));

/** Every question answered; required items must be Yes (true). */
export const isChecklistFormComplete = (conditions, answers) => {
  if (!conditions.length) return true;

  const allAnswered = conditions.every(
    (c) => answers[c._id] === true || answers[c._id] === false,
  );
  const requiredMet = conditions
    .filter((c) => c.isRequired)
    .every((c) => answers[c._id] === true);

  return allAnswered && requiredMet;
};

export const countChecklistProgress = (conditions, answers) => {
  const answered = conditions.filter(
    (c) => answers[c._id] === true || answers[c._id] === false,
  ).length;
  const required = conditions.filter((c) => c.isRequired);
  const requiredYes = required.filter((c) => answers[c._id] === true).length;

  return { answered, total: conditions.length, requiredYes, requiredTotal: required.length };
};
