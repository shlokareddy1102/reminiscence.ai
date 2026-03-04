import cv2
from face_engine import FaceEngine
from tracker import SimpleTracker

engine = FaceEngine()
engine.rebuild_index()

tracker = SimpleTracker()
track_id_to_name = {}

cap = cv2.VideoCapture(0)

print("Webcam started. Press q to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = engine.search(frame)

    bboxes = [res["bbox"] for res in results]
    tracks = tracker.update(bboxes)

    for track_id, bbox in tracks.items():

        # find corresponding recognition result
        matched_result = None

        for res in results:
            if tuple(res["bbox"]) == tuple(bbox):
                matched_result = res
                break

        if matched_result:
            if track_id not in track_id_to_name:
                track_id_to_name[track_id] = matched_result["name"]

        name = track_id_to_name.get(track_id, "Unknown")

        x1, y1, x2, y2 = bbox
        label = f"ID {track_id} - {name}"

        cv2.rectangle(frame, (x1, y1), (x2, y2), (0,255,0), 2)
        cv2.putText(frame, label,
                    (x1, y1-10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (0,255,0),
                    2)

    cv2.imshow("Dementia Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
