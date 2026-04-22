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
            print(f"  ⚠ No face detected in image (shape: {image.shape})")
            return None
        
        # Use the largest face
        faces = sorted(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]), reverse=True)
        print(f"  ✓ Detected {len(faces)} face(s), using largest")
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
            known_people: List of dicts with keys: id, name, relationship, photo (base64 or file path)
        """
        # Reset index and mappings
        self.index = faiss.IndexFlatL2(self.embedding_dim)
        self.person_ids = []
        self.person_metadata = {}
        
        embeddings = []
        
        for person in known_people:
            person_id = person['id']
            
            # Load image (support both file path and base64)
            if isinstance(person['photo'], str):
                if person['photo'].startswith('data:image'):
                    # Base64 data URI
                    import base64
                    import re
                    
                    # Extract base64 data
                    base64_data = re.sub('^data:image/.+;base64,', '', person['photo'])
                    img_data = base64.b64decode(base64_data)
                    img_array = np.frombuffer(img_data, dtype=np.uint8)
                    image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
                else:
                    # File path
                    image = cv2.imread(person['photo'])
            else:
                # Assume it's already a numpy array
                image = person['photo']
            
            if image is None:
                print(f"Warning: Could not load image for person {person_id}")
                continue
            
            # Extract embedding
            embedding = self.get_embedding(image)
            if embedding is None:
                print(f"Warning: No face detected for person {person_id}")
                continue
            
            embeddings.append(embedding)
            self.person_ids.append(person_id)
            self.person_metadata[person_id] = {
                'name': person.get('name', 'Unknown'),
                'relationship': person.get('relationship', ''),
                'notes': person.get('notes', '')
            }
        
        # Add to FAISS index
        if len(embeddings) > 0:
            embeddings_array = np.array(embeddings).astype('float32')
            self.index.add(embeddings_array)
            print(f"Index rebuilt with {len(embeddings)} people")
        else:
            print("Warning: No valid embeddings found, index is empty")
    
    def recognize(self, image, top_k=1, threshold=0.6):
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
            print("  ✗ Cannot recognize: No face detected in query image")
            return []
        
        # Check if index has any entries
        if self.index.ntotal == 0:
            return []
        
        # Bounds check for top_k
        actual_k = min(top_k, self.index.ntotal)
        
        # Search FAISS index
        embedding_query = np.array([embedding]).astype('float32')
        distances, indices = self.index.search(embedding_query, actual_k)
        
        # Show all candidates
        print(f"  Candidates:")
        for dist, idx in zip(distances[0], indices[0]):
            person_id = self.person_ids[idx]
            metadata = self.person_metadata[person_id]
            match_status = '✓ MATCH' if dist <= threshold else '✗ too far'
            print(f"    {metadata['name']}: distance={dist:.3f} {match_status}")
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            # Check threshold (L2 distance, so lower is better)
            # Typical threshold: 0.6 for normalized embeddings
            if dist > threshold:
                continue
            
            person_id = self.person_ids[idx]
            metadata = self.person_metadata[person_id]
            
            # Convert L2 distance to confidence score (0-1, higher is better)
            confidence = max(0, 1 - (dist / 2.0))  # Normalize to 0-1 range
            
            results.append({
                'person_id': person_id,
                'name': metadata['name'],
                'relationship': metadata['relationship'],
                'distance': float(dist),
                'confidence': float(confidence)
            })
        
        return results
    
    def get_stats(self):
        """Get index statistics."""
        return {
            'total_indexed': self.index.ntotal,
            'embedding_dim': self.embedding_dim,
            'person_count': len(self.person_ids)
        }
