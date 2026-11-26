const sharp = require("sharp");

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function perceptualHash(filePath) {
  const { data } = await sharp(filePath)
    .resize(32, 32, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const coefficients = [];
  for (let u = 0; u < 8; u += 1) {
    for (let v = 0; v < 8; v += 1) {
      let sum = 0;
      for (let x = 0; x < 32; x += 1) {
        for (let y = 0; y < 32; y += 1) {
          sum += data[x * 32 + y]
            * Math.cos(((2 * x + 1) * u * Math.PI) / 64)
            * Math.cos(((2 * y + 1) * v * Math.PI) / 64);
        }
      }
      coefficients.push(sum);
    }
  }

  const threshold = median(coefficients.slice(1));
  let hash = 0n;
  coefficients.forEach((value, index) => {
    if (value > threshold) hash |= 1n << BigInt(63 - index);
  });
  return hash.toString(16).padStart(16, "0");
}

function hammingDistance(first, second) {
  let value = BigInt("0x" + first) ^ BigInt("0x" + second);
  let distance = 0;
  while (value) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

function similarityPercent(first, second) {
  return Math.round(((64 - hammingDistance(first, second)) / 64) * 100);
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { perceptualHash, similarityPercent, distanceInMeters };
