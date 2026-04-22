import numpy as np
import cv2
import faiss
from insightface.app import FaceAnalysis

class FaceEngine:
    """Production-grade face recognition engine using InsightFace + FAISS."""
    
    def __init__(self, embedding_dim=512):
        """Initialize InsightFace model and FAISS index."""
        self.app = FaceAnalysis(providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        
        self.embedding_dim = embedding_dim
        self.index = faiss.IndexFlatL2(embedding_dim)
        self.person_ids = []  # Maps index position to person ID
        self.person_metadata = {}  # Maps person ID to metadata (name, relationship, etc.)
    
    def get_embedding(self, image):
        """
        Extract face embedding from image.
        
        Args:
            image: BGR image (numpy array)
        
        Returns:
            numpy array of shape (512,) or None if no face detected
        """
        faces = self.app.get(image)
        if len(faces) == 0:
            print(f"  [WARN] No face detected in image (shape: {image.shape})")
            return None
        
        # Use the largest face
        faces = sorted(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
        print(f"  [OK] Detected {len(faces)} face(s), using largest")
        embedding = faces[0].embedding
        
        # Normalize embedding
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        
        return embedding.astype('float32')
    
    def rebuild_index(self, known_people):
        """
        Rebuild FAISS index from scratch with known people.
        
        Args:
            known_people: List of dicts with keys: id, name, relationship, photo/photos (base64 or file path)
        """
        # Reset index and mappings
        self.index = faiss.IndexFlatL2(self.embedding_dim)
        self.person_ids = []
        self.person_metadata = {}
        
        embeddings = []
        diagnostics = {
            'input_people': len(known_people),
            'indexed_embeddings': 0,
            'indexed_unique_people': 0,
            'skipped_no_image': [],
            'skipped_no_face': [],
            'indexed_person_ids': []
        }
        
        for person in known_people:
            person_id = person['id']
            photos = []
            if isinstance(person.get('photos'), list):
                photos.extend([photo for photo in person.get('photos', []) if isinstance(photo, str) and photo.strip()])
            if isinstance(person.get('photo'), str) and person.get('photo', '').strip():
                photos.insert(0, person['photo'])

            for photo_item in photos:
                # Load image (support both file path and base64)
                if isinstance(photo_item, str):
                    if photo_item.startswith('data:image'):
                        # Base64 data URI
                        import base64
                        import re
                        
                        # Extract base64 data
                        base64_data = re.sub('^data:image/.+;base64,', '', photo_item)
                        img_data = base64.b64decode(base64_data)
                        img_array = np.frombuffer(img_data, dtype=np.uint8)
                        image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                    else:
                        # File path
                        image = cv2.imread(photo_item)
                else:
                    # Assume it's already a numpy array
                    image = photo_item
                
                if image is None:
                    print(f"Warning: Could not load image for person {person_id}")
                    if person_id not in diagnostics['skipped_no_image']:
                        diagnostics['skipped_no_image'].append(person_id)
                    continue
                
                # Extract embedding
                embedding = self.get_embedding(image)
                if embedding is None:
                    print(f"Warning: No face detected for person {person_id}")
                    if person_id not in diagnostics['skipped_no_face']:
                        diagnostics['skipped_no_face'].append(person_id)
                    continue
                
                embeddings.append(embedding)
                self.person_ids.append(person_id)
                self.person_metadata[person_id] = {
                    'name': person.get('name', 'Unknown'),
                    'relationship': person.get('relationship', ''),
                    'notes': person.get('notes', '')
                }
                if person_id not in diagnostics['indexed_person_ids']:
                    diagnostics['indexed_person_ids'].append(person_id)
        
        # Add to FAISS index
        if len(embeddings) > 0:
            embeddings_array = np.array(embeddings).astype('float32')
            self.index.add(embeddings_array)
            print(f"Index rebuilt with {len(embeddings)} embeddings across {len(set(self.person_ids))} people")
        else:
            print("Warning: No valid embeddings found, index is empty")

        diagnostics['indexed_embeddings'] = int(self.index.ntotal)
        diagnostics['indexed_unique_people'] = len(set(self.person_ids))
        return diagnostics
    
    def recognize(self, image, top_k=1, threshold=0.8):
        """
        Recognize face in image against indexed known people.
        
        Args:
            image: BGR image (numpy array)
            top_k: Number of top matches to return
            threshold: Distance threshold (lower is more similar; L2 distance)
        
        Returns:
            List of dicts with keys: person_id, name, relationship, distance, confidence
            Empty list if no match or no face detected
        """
        print(f"Recognition request (threshold={threshold}, indexed={self.index.ntotal}):")
        
        # Extract embedding from query image
        embedding = self.get_embedding(image)
        if embedding is None:
            print("  [FAIL] Cannot recognize: No face detected in query image")
            return []
        
        # Check if index has any entries
        if self.index.ntotal == 0:
            return []
        
        # Bounds check for top_k
        actual_k = min(max(top_k, 1), self.index.ntotal)
        
        # Search FAISS index
        embedding_query = np.array([embedding]).astype('float32')
        distances, indices = self.index.search(embedding_query, actual_k)
        
        # Show all candidates
        print(f"  Candidates:")
        best_results = {}
        for dist, idx in zip(distances[0], indices[0]):
            person_id = self.person_ids[idx]
            metadata = self.person_metadata[person_id]
            match_status = '[MATCH]' if dist <= threshold else '[NO_MATCH] too far'
            print(f"    {metadata['name']}: distance={dist:.3f} {match_status}")

            if dist > threshold:
                continue

            current_best = best_results.get(person_id)
            if current_best is None or dist < current_best['distance']:
                best_results[person_id] = {
                    'person_id': person_id,
                    'name': metadata['name'],
                    'relationship': metadata['relationship'],
                    'distance': float(dist),
                    'confidence': float(max(0, 1 - (dist / 2.0)))
                }
        
        results = sorted(best_results.values(), key=lambda item: item['distance'])
        return results
    
    def get_stats(self):
        """Get index statistics."""
        unique_people = len(set(self.person_ids))
        return {
            'total_indexed': self.index.ntotal,
            'embedding_dim': self.embedding_dim,
            'embedding_count': self.index.ntotal,
            'person_count': unique_people,
            'unique_person_count': unique_people
        }

    def get_index_debug(self, limit=25):
        """Return inspectable FAISS index details for debugging."""
        per_person_counts = {}
        for person_id in self.person_ids:
            per_person_counts[person_id] = per_person_counts.get(person_id, 0) + 1

        sample_entries = []
        max_items = max(1, int(limit))
        for idx, person_id in enumerate(self.person_ids[:max_items]):
            metadata = self.person_metadata.get(person_id, {})
            sample_entries.append({
                'index_position': idx,
                'person_id': person_id,
                'name': metadata.get('name', 'Unknown'),
                'relationship': metadata.get('relationship', ''),
                'embedding_count_for_person': per_person_counts.get(person_id, 0)
            })

        return {
            'stats': self.get_stats(),
            'per_person_embedding_counts': per_person_counts,
            'sample_entries': sample_entries
        }
