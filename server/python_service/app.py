#!/usr/bin/env python3
"""
Flask microservice for face recognition using InsightFace + FAISS.
Provides endpoints for index management and real-time recognition.
"""

import os
import base64
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from face_engine import FaceEngine

app = Flask(__name__)
CORS(app)  # Enable CORS for Node.js backend

# Initialize face engine
face_engine = FaceEngine(embedding_dim=512)

def base64_to_image(base64_str):
    """Convert base64 string to OpenCV image."""
    import re
    
    # Remove data URI prefix if present
    base64_data = re.sub('^data:image/.+;base64,', '', base64_str)
    
    # Decode base64
    img_data = base64.b64decode(base64_data)
    img_array = np.frombuffer(img_data, dtype=np.uint8)
    image = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    
    return image

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    stats = face_engine.get_stats()
    return jsonify({
        'status': 'healthy',
        'service': 'face-recognition',
        'stats': stats
    })

@app.route('/rebuild-index', methods=['POST'])
def rebuild_index():
    """
    Rebuild FAISS index with known people.
    
    Request body:
        {
            "people": [
                {
                    "id": "64fa...",
                    "name": "Alice",
                    "relationship": "Daughter",
                    "photo": "data:image/png;base64,..."
                },
                ...
            ]
        }
    """
    try:
        data = request.json
        people = data.get('people', [])
        
        if not people:
            return jsonify({'error': 'No people provided'}), 400
        
        # Convert base64 photos to images
        processed_people = []
        for person in people:
            try:
                photo_base64 = person.get('photo', '')
                if not photo_base64:
                    print(f"Skipping person {person.get('id')} - no photo")
                    continue
                
                image = base64_to_image(photo_base64)
                if image is None:
                    print(f"Failed to decode image for person {person.get('id')}")
                    continue
                
                processed_people.append({
                    'id': person['id'],
                    'name': person.get('name', 'Unknown'),
                    'relationship': person.get('relationship', ''),
                    'notes': person.get('notes', ''),
                    'photo': image
                })
            except Exception as e:
                print(f"Error processing person {person.get('id')}: {str(e)}")
                continue
        
        # Rebuild index
        face_engine.rebuild_index(processed_people)
        stats = face_engine.get_stats()
        
        return jsonify({
            'success': True,
            'message': f'Index rebuilt with {stats["person_count"]} people',
            'stats': stats
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/recognize', methods=['POST'])
def recognize_face():
    """
    Recognize face in provided image.
    
    Request body:
        {
            "image": "data:image/png;base64,...",
            "top_k": 1,
            "threshold": 0.6
        }
    
    Response:
        {
            "matches": [
                {
                    "person_id": "64fa...",
                    "name": "Alice",
                    "relationship": "Daughter",
                    "distance": 0.23,
                    "confidence": 0.93
                }
            ]
        }
    """
    try:
        data = request.json
        
        image_base64 = data.get('image', '')
        if not image_base64:
            return jsonify({'error': 'No image provided'}), 400
        
        top_k = data.get('top_k', 1)
        threshold = data.get('threshold', 0.6)
        
        # Convert base64 to image
        image = base64_to_image(image_base64)
        if image is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Recognize face
        matches = face_engine.recognize(image, top_k=top_k, threshold=threshold)
        
        # Debug logging
        if len(matches) > 0:
            print(f"✓ Match found: {matches[0]['name']} (distance: {matches[0]['distance']:.3f}, confidence: {matches[0]['confidence']:.3f})")
        else:
            print(f"✗ No match (threshold: {threshold})")
        
        return jsonify({
            'matches': matches,
            'found': len(matches) > 0
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get FAISS index statistics."""
    stats = face_engine.get_stats()
    return jsonify(stats)

if __name__ == '__main__':
    port = int(os.environ.get('PYTHON_SERVICE_PORT', 5002))
    print(f"Starting face recognition service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
