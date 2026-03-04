import numpy as np

class SimpleTracker:
    def __init__(self, max_distance=50):
        self.next_id = 0
        self.tracks = {}
        self.max_distance = max_distance

    def _center(self, bbox):
        x1, y1, x2, y2 = bbox
        return np.array([(x1+x2)//2, (y1+y2)//2])

    def update(self, detections):
        updated_tracks = {}

        for bbox in detections:
            center = self._center(bbox)
            matched_id = None

            for track_id, old_bbox in self.tracks.items():
                old_center = self._center(old_bbox)
                distance = np.linalg.norm(center - old_center)

                if distance < self.max_distance:
                    matched_id = track_id
                    break

            if matched_id is None:
                matched_id = self.next_id
                self.next_id += 1

            updated_tracks[matched_id] = bbox

        self.tracks = updated_tracks
        return self.tracks
