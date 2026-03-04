export class SimpleTracker {
  constructor(maxDistance = 70) {
    this.maxDistance = maxDistance;
    this.nextId = 0;
    this.tracks = new Map();
  }

  center(bbox) {
    const [x1, y1, x2, y2] = bbox;
    return [(x1 + x2) / 2, (y1 + y2) / 2];
  }

  distance(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  update(detections) {
    const updated = new Map();
    const usedTrackIds = new Set();

    for (const bbox of detections) {
      const detCenter = this.center(bbox);
      let bestTrackId = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const [trackId, oldBbox] of this.tracks.entries()) {
        if (usedTrackIds.has(trackId)) continue;
        const oldCenter = this.center(oldBbox);
        const distance = this.distance(detCenter, oldCenter);

        if (distance < this.maxDistance && distance < bestDistance) {
          bestDistance = distance;
          bestTrackId = trackId;
        }
      }

      if (bestTrackId === null) {
        bestTrackId = this.nextId;
        this.nextId += 1;
      }

      usedTrackIds.add(bestTrackId);
      updated.set(bestTrackId, bbox);
    }

    this.tracks = updated;

    const asObject = {};
    for (const [trackId, bbox] of this.tracks.entries()) {
      asObject[trackId] = bbox;
    }

    return asObject;
  }
}
