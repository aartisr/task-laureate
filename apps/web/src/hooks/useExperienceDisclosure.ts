import { useEffect, useRef } from 'react';
import type { WorkspaceExperience } from '../core/preferences/workspaceExperience';

/** Keeps native disclosure state aligned with the selected presentation mode. */
export function useExperienceDisclosure(experience: WorkspaceExperience) {
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (disclosureRef.current) disclosureRef.current.open = experience === 'workspace';
  }, [experience]);
  return disclosureRef;
}