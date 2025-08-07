
export function extractUserInterests(assessmentInterests: string[] = [], chatTopics: string[] = []): string[] {
  const all = [...(assessmentInterests || []), ...(chatTopics || [])];
  return Array.from(new Set(all.map(i => i.toLowerCase())));
}

export function recommendTopics(interests: string[]): string[] {
  if (!interests.length) return ["AI", "technology", "wellbeing"];
  return interests.slice(0, 3);
}