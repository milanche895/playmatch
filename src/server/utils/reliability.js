const RELIABILITY_REWARD_POINTS = 2;
const RELIABILITY_MAX = 100;
const RELIABILITY_MIN = 0;

/**
 * Award reliability points to players who successfully played a match.
 * Caps at RELIABILITY_MAX (100).
 * @param {import('mongoose').Types.ObjectId[]|string[]} playerIds
 */
async function rewardReliabilityForCompletedMatch(playerIds, User) {
  const ids = (playerIds || []).filter(Boolean);
  if (ids.length === 0) return;

  await User.updateMany(
    { _id: { $in: ids } },
    [
      {
        $set: {
          reliabilityScore: {
            $min: [
              RELIABILITY_MAX,
              { $add: [{ $ifNull: ['$reliabilityScore', RELIABILITY_MAX] }, RELIABILITY_REWARD_POINTS] }
            ]
          }
        }
      }
    ]
  );
}

/**
 * Apply a reliability penalty, floored at 0.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {number} points
 */
async function penalizeReliability(userId, points, User) {
  if (!userId || !points || points <= 0) return;
  await User.findByIdAndUpdate(userId, [
    {
      $set: {
        reliabilityScore: {
          $max: [
            RELIABILITY_MIN,
            { $subtract: [{ $ifNull: ['$reliabilityScore', RELIABILITY_MAX] }, points] }
          ]
        }
      }
    }
  ]);
}

function getReliabilityPenaltyPoints(hoursBeforeMatch) {
  if (hoursBeforeMatch >= 2) return 0;
  if (hoursBeforeMatch >= 1) return 10;
  return 15;
}

module.exports = {
  RELIABILITY_REWARD_POINTS,
  RELIABILITY_MAX,
  RELIABILITY_MIN,
  rewardReliabilityForCompletedMatch,
  penalizeReliability,
  getReliabilityPenaltyPoints
};
