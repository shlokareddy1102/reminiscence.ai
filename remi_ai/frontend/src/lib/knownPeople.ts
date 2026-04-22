import { apiRequest } from "@/lib/api";

export interface KnownPerson {
  id: string;
  patientId: string;
  name: string;
  relation: string;
  notes: string;
  photoUrl: string;
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
  photoFile: File;
}): Promise<KnownPerson> {
  const formData = new FormData();
  formData.append("patientId", payload.patientId);
  formData.append("name", payload.name);
  formData.append("relationship", payload.relation);
  formData.append("notes", payload.notes || "");
  formData.append("photo", payload.photoFile);

  const created = await apiRequest("/api/known-people", {
    method: "POST",
    body: formData
  });

  return mapKnownPerson(created);
}

export async function removeKnownPerson(id: string): Promise<void> {
  await apiRequest(`/api/known-people/${id}`, { method: "DELETE" });
}

export async function markKnownPersonVisited(id: string): Promise<void> {
  await apiRequest(`/api/known-people/${id}/mark-visited`, { method: "PUT" });
}

export async function recognizePerson(image: string, threshold = 0.6): Promise<{ found: boolean; matches: RecognitionMatch[] }> {
  return apiRequest("/api/known-people/recognize", {
    method: "POST",
    body: JSON.stringify({ image, top_k: 1, threshold })
  });
}

export async function reportUnknownPerson(patientId: string, faceImage: string): Promise<void> {
  await apiRequest("/api/known-people/report-unknown", {
    method: "POST",
    body: JSON.stringify({ patientId, faceImage })
  });
}
