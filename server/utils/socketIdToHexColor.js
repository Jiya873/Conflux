function socketIdToHexColor(socketId) {
  let hash = 0;
  for (let i = 0; i < socketId.length; i++) {
    hash = socketId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }

  // Derive hue from hash for color variety; fix S and L to guarantee
  // readable colors on a white editor background (not too dark or too pale).
  const h = Math.abs(hash) % 360;
  const s = 65; // %
  const l = 42; // %

  // HSL → hex
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const toChannel = (n) => {
    const k = (n + h / 30) % 12;
    const val = ln - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(val * 255)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${toChannel(0)}${toChannel(8)}${toChannel(4)}`;
}

module.exports = socketIdToHexColor;
