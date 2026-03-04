#!/bin/bash

# Test script to check face recognition with a known person's photo

echo "Fetching known person photo..."
PHOTO=$(curl -s "http://localhost:5001/api/known-people?patientId=69a87ffe6d65f8889bf194cd" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for person in data:
    if person['name'] == 'shloka':
        print(person['photo'])
        break
")

echo "Testing recognition with the same photo..."
curl -X POST http://localhost:5002/recognize \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$PHOTO\", \"top_k\": 1, \"threshold\": 1.2}" | python3 -m json.tool

echo -e "\n\nThis should match with distance very close to 0 (same photo)."
