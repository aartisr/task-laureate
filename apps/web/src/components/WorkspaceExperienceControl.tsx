import { toggleWorkspaceExperience, useWorkspaceExperience } from '../core/preferences/workspaceExperience';

export function WorkspaceExperienceControl() {
  const experience = useWorkspaceExperience();
  const isFocus = experience === 'focus';
  return <div className="workspace-experience-control" aria-label="Workspace experience">
    <div><strong>{isFocus ? 'Focus Mode' : 'Workspace Mode'}</strong><small>{isFocus ? 'Keep the next action clear' : 'Show full planning tools'}</small></div>
    <button type="button" className="secondary-button" onClick={toggleWorkspaceExperience} aria-label={isFocus ? 'Switch to Workspace Mode' : 'Switch to Focus Mode'}>{isFocus ? 'Use Workspace Mode' : 'Use Focus Mode'}</button>
  </div>;
}