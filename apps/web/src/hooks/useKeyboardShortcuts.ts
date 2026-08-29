import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutConfig {
  onNewList?: () => void;
  onNewTask?: () => void;
  onFocusSearch?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenSettings?: () => void;
  onGoHome?: () => void;
  onToggleSidebar?: () => void;
  onVoiceAssistant?: () => void;
}

/**
 * Universal keyboard shortcuts hook
 * Provides common shortcuts for productivity:
 * - Ctrl/Cmd + N: New list
 * - Ctrl/Cmd + T: New task
 * - Ctrl/Cmd + F: Focus search
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Shift + Z: Redo
 * - Ctrl/Cmd + ,: Settings
 * - Ctrl/Cmd + H: Home
 * - Ctrl/Cmd + B: Toggle sidebar
 */
export function useKeyboardShortcuts(config: KeyboardShortcutConfig) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check for Ctrl (Windows/Linux) or Cmd (macOS)
      const isModifierKey = e.ctrlKey || e.metaKey;

      if (!isModifierKey) return;

      // Prevent default browser shortcuts
      const shortcutKey = e.key.toLowerCase();

      switch (shortcutKey) {
        case 'n':
          // New list
          if (config.onNewList) {
            e.preventDefault();
            config.onNewList();
          }
          break;

        case 't':
          // New task
          if (config.onNewTask) {
            e.preventDefault();
            config.onNewTask();
          }
          break;

        case 'f':
          // Focus search
          if (config.onFocusSearch) {
            e.preventDefault();
            config.onFocusSearch();
          }
          break;

        case 'z':
          // Undo or Redo (Shift+Cmd+Z)
          if (e.shiftKey) {
            // Redo
            if (config.onRedo) {
              e.preventDefault();
              config.onRedo();
            }
          } else {
            // Undo
            if (config.onUndo) {
              e.preventDefault();
              config.onUndo();
            }
          }
          break;

        case ',':
          // Settings
          if (config.onOpenSettings) {
            e.preventDefault();
            config.onOpenSettings();
          }
          break;

        case 'h':
          // Home
          if (config.onGoHome) {
            e.preventDefault();
            config.onGoHome();
          }
          break;

        case 'b':
          // Toggle sidebar
          if (config.onToggleSidebar) {
            e.preventDefault();
            config.onToggleSidebar();
          }
          break;

        
        case 'v':
          if (e.shiftKey && config.onVoiceAssistant) {
            e.preventDefault();
            config.onVoiceAssistant();
          }
          break;
        default:
          break;
      }
    },
    [
      config.onNewList,
      config.onNewTask,
      config.onFocusSearch,
      config.onUndo,
      config.onRedo,
      config.onOpenSettings,
      config.onGoHome,
      config.onToggleSidebar,
      config.onVoiceAssistant,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Helper to get keyboard shortcut display text
 * Shows Cmd on macOS, Ctrl on Windows/Linux
 */
export function getShortcutText(key: string): string {
  const modifier = navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
  const shortcuts: Record<string, string> = {
    newList: `${modifier}+N`,
    newTask: `${modifier}+T`,
    search: `${modifier}+F`,
    undo: `${modifier}+Z`,
    redo: `${modifier}+Shift+Z`,
    settings: `${modifier}+,`,
    home: `${modifier}+H`,
    sidebar: `${modifier}+B`,
    voice: `${modifier}+Shift+V`,
  };
  return shortcuts[key] || key;
}

/**
 * Hook to display keyboard shortcuts help
 */
export function useKeyboardShortcutsHelp() {
  const shortcuts = [
    { key: 'newList', label: 'New List', display: getShortcutText('newList') },
    { key: 'newTask', label: 'New Task', display: getShortcutText('newTask') },
    { key: 'search', label: 'Search', display: getShortcutText('search') },
    { key: 'undo', label: 'Undo', display: getShortcutText('undo') },
    { key: 'redo', label: 'Redo', display: getShortcutText('redo') },
    { key: 'settings', label: 'Settings', display: getShortcutText('settings') },
    { key: 'home', label: 'Home', display: getShortcutText('home') },
    { key: 'sidebar', label: 'Toggle Sidebar', display: getShortcutText('sidebar') },
    { key: 'voice', label: 'Voice Assistant', display: getShortcutText('voice') },
  ];

  return shortcuts;
}
