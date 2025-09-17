// src/api/getTechnicians.ts
export async function getTechnicians() {
  try {
    const res = await fetch("/.netlify/functions/technicians");
    if (!res.ok) {
      throw new Error(`Failed to fetch technicians: ${res.status}`);
    }
    const data = await res.json();
    return data.technicians || [];
  } catch (err) {
    console.error("Error in getTechnicians:", err);
    return [];
  }
}