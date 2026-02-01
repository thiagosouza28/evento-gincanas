export function createId(): string {
  if (typeof globalThis !== 'undefined') {
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
      return cryptoObj.randomUUID();
    }
    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
      return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16);
    const value = ch === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}
