/**
 * Voice Command Parser
 * Parses natural language spoken transcripts into actionable task and list operations.
 */

export interface ParsedVoiceIntent {
  taskTitle: string;
  listName?: string;
  isNewListCreation: boolean;
  rawTranscript: string;
}

export function parseVoiceCommand(transcript: string): ParsedVoiceIntent {
  const text = transcript.trim().toLowerCase();
  
  let listName: string | undefined = undefined;
  let isNewListCreation = false;
  let taskTitle = text;

  // Pattern: "create list [name] with task [title]" or "new list [name] task [title]"
  const newListMatch = text.match(/(?:create|new)\s+list\s+(.+?)\s+(?:with\s+task|task|containing)\s+(.+)$/i);
  if (newListMatch) {
    listName = newListMatch[1].trim();
    taskTitle = newListMatch[2].trim();
    isNewListCreation = true;
  } else {
    // Clean common trigger prefixes
    let cleaned = text
      .replace(/^(please\s+)?(add|create|put|schedule|remind me to)\s+/i, '')
      .trim();

    taskTitle = cleaned;

    // Pattern: "task [title] to list [name]" or "task [title] in [name]" or "task [title] under [name]"
    const toListMatch = cleaned.match(/(.+?)\s+(?:to|in|under)\s+(?:the\s+)?(?:list\s+)?(.+)$/i);
    if (toListMatch) {
      taskTitle = toListMatch[1].trim();
      listName = toListMatch[2].trim();
    } else {
      // Pattern: "add [title] to [name]"
      const addToListMatch = cleaned.match(/(.+?)\s+to\s+(.+)$/i);
      if (addToListMatch && !addToListMatch[2].includes('today') && !addToListMatch[2].includes('tomorrow')) {
        taskTitle = addToListMatch[1].trim();
        listName = addToListMatch[2].trim();
      }
    }
  }

  // Capitalize task title nicely
  if (taskTitle) {
    taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);
    taskTitle = taskTitle.replace(/[.!?]$/, '');
  }
  if (listName) {
    listName = listName.charAt(0).toUpperCase() + listName.slice(1);
    listName = listName.replace(/[.!?]$/, '');
  }

  return {
    taskTitle: taskTitle || transcript,
    listName,
    isNewListCreation,
    rawTranscript: transcript,
  };
}
