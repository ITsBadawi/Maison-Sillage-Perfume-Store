/** Preserve int8 money as decimal text and reject numbers already rounded by JSON parsing. */
export function minorUnitString(value: number | string): string {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new RangeError('Minor-unit money must be a non-negative safe integer or decimal string.');
  }
  const text = String(value);
  if (!/^\d+$/.test(text)) throw new TypeError('Minor-unit money must be a non-negative integer string.');
  return text;
}
