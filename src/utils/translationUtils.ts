export function flattenTranslations(
  obj: any,
  prefix: string = '',
  keys: string[],
  values: Map<string, string>
): void {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const compositeKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      // Recursively flatten nested objects
      flattenTranslations(obj[key], compositeKey, keys, values);
    } else {
      keys.push(compositeKey);
      values.set(compositeKey, String(obj[key]));
    }
  }
}