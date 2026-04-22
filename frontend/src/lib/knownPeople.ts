import { apiRequest } from "@/lib/api";

const FACE_SERVICE_URL = "http://localhost:8001";

export interface KnownPerson {
  id: string;
  patientId: string;
  name: string;
  relation: string;
  notes: string;
  photoUrl: string;
  photos?: string[];
  lastVisitedTime: string | null;
  visitCount: number;
}

export interface RecognitionMatch {
  person_id: string;
  name: string;
  relationship: string;
  distance: number;
  confidence: number;
}

interface ApiKnownPerson {
  _id: string;
  patientId: string;
  name: string;
  relationship: string;
  notes?: string;
  photo: string;
  photos?: string[];
  lastVisitedTime?: string | null;
  visitCount?: number;
}

function mapKnownPerson(person: ApiKnownPerson): KnownPerson {
  return {
    id: person._id,
    patientId: person.patientId,
    name: person.name,
    relation: person.relationship,
    notes: person.notes || "",
    photoUrl: person.photo,
    photos: Array.isArray(person.photos) ? person.photos : [],
    lastVisitedTime: person.lastVisitedTime || null,
    visitCount: person.visitCount || 0
  };
}

export async function getKnownPeople(patientId?: string | null): Promise<KnownPerson[]> {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const people = await apiRequest(`/api/known-people${query}`);
  return Array.isArray(people) ? people.map(mapKnownPerson) : [];
}

export async function addKnownPerson(payload: {
  patientId: string;
  name: string;
  relation: string;
  notes?: string;
  photoData: string;
}): Promise<KnownPerson> {
  const created = await apiRequest("/api/known-people", {
    method: "POST",
    body: JSON.stringify({
      patientId: payload.patientId,
      name: payload.name,
      relationship: payload.relation,
      notes: payload.notes || "",
      photoData: payload.photoData
    })
  });

  return mapKnownPerson(created);
}

export async function addKnownPersonPhoto(id: string, photoData: string): Promise<KnownPerson> {
  const updated = await apiRequest(`/api/known-people/${id}/photos`, {
    method: "POST",
    body: JSON.stringify({ photoData })
  });

  return mapKnownPerson(updated);
}

export async function removeKnownPerson(id: string): Promise<void> {
  await apiRequest(`/api/known-people/${id}`, { method: "DELETE" });
}

export async function markKnownPersonVisited(id: string): Promise<void> {
  await apiRequest(`/api/known-people/${id}/mark-visited`, { method: "PUT" });
}

export async function recognizePerson(image: string, threshold = 0.8): Promise<{ found: boolean; matches: RecognitionMatch[] }> {
  const response = await fetch(`${FACE_SERVICE_URL}/recognize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ image, top_k: 1, threshold })
  });

  let data: { found?: boolean; matches?: RecognitionMatch[]; error?: string } | null = null;
  try {
    data = await response.json();
  } catch (_err) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || "Face recognition request failed");
  }

  return {
    found: Boolean(data?.found),
    matches: Array.isArray(data?.matches) ? data.matches : []
  };
}

export async function reportUnknownPerson(patientId: string, faceImage: string): Promise<void> {
  await apiRequest("/api/known-people/report-unknown", {
    method: "POST",
    body: JSON.stringify({ patientId, faceImage })
  });
}
