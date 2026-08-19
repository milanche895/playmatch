const QUICK_MESSAGE_PRESETS = [
  'Donosim loptu',
  'Zasmetaću 5 min',
  'Imam rezervne majice',
  'Koju boju majica?',
  'Ja bela',
  'Ja crvena',
  'Sve OK, vidimo se',
];

const QUICK_MESSAGE_MAX_LENGTH = 200;
const QUICK_MESSAGE_MAX_STORED = 100;
const QUICK_MESSAGE_RATE_LIMIT_MS = 2000;

function isParticipant(match, userId) {
  if (!match || !userId) return false;
  const id = userId.toString();
  return (match.players || []).some((p) => {
    const pid = p._id ? p._id.toString() : p.toString();
    return pid === id;
  });
}

function formatQuickMessage(msg) {
  if (!msg) return null;
  const user = msg.userId;
  return {
    _id: msg._id,
    text: msg.text,
    isPreset: !!msg.isPreset,
    createdAt: msg.createdAt,
    userId: user && typeof user === 'object'
      ? { _id: user._id, name: user.name }
      : { _id: user },
  };
}

module.exports = {
  QUICK_MESSAGE_PRESETS,
  QUICK_MESSAGE_MAX_LENGTH,
  QUICK_MESSAGE_MAX_STORED,
  QUICK_MESSAGE_RATE_LIMIT_MS,
  isParticipant,
  formatQuickMessage,
};
