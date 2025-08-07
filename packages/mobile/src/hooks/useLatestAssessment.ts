import { useEffect, useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { generateAssessmentResult, AssessmentResult } from '../lib/assessment/analyzer';

// Simple in-memory cache for latest assessment per user
const assessmentCache: Record<string, AssessmentResult> = {};

export function useLatestAssessment(userId: string) {
  const { getUserAssessment } = useFirebase();
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    if (!userId) return;
    // Check cache first
    if (assessmentCache[userId]) {
      setAssessment(assessmentCache[userId]);
      return;
    }
    getUserAssessment(userId).then(res => {
      if (res.success && res.data.length > 0) {
        const sorted = res.data.slice().sort((a: any, b: any) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });
        const latest = sorted[0];
        let result: AssessmentResult;
        if (latest.result) {
          result = latest.result;
        } else if (latest.responses) {
          result = generateAssessmentResult(latest.responses);
        } else {
          // fallback: try to generate from the whole doc
          result = generateAssessmentResult(latest);
        }
        assessmentCache[userId] = result;
        setAssessment(result);
      }
    });
  }, [userId]);

  return assessment;
}