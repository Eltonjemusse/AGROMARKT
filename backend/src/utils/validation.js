const isObjectBody = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const positiveNumber = (value) => {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return NaN;
    value = Number(text);
  }
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : NaN;
};

const positiveId = (value) => {
  if (typeof value === 'string') {
    if (!/^\d+$/.test(value)) return NaN;
    value = Number(value);
  }
  // Prisma Int maps to a signed 32-bit integer in PostgreSQL.
  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647 ? value : NaN;
};

module.exports = { isObjectBody, positiveNumber, positiveId };
