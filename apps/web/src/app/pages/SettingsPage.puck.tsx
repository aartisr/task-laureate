/**
 * Settings Page - Puck Compliant Version Example
 * 
 * Demonstrates how preferences and settings pages can be Puck-compliant
 */

import { useState } from 'react';
import { useTheme } from '../../core/themes/ThemeProvider';
import type { ThemeName } from '../../core/themes/themes';
import { usePuckContent } from '../../components/withPuckEditor';
import { PuckPageRenderer } from '../../components/PuckPageRenderer';

export function SettingsPagePuckCompliant() {
  // Load Puck content
  const puckContent = usePuckContent('settings');

  // Business logic: Theme selection
  const { currentTheme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    taskDueSoon: true,
    taskCompleted: true,
    taskAssigned: true,
    weeklyDigest: false,
  });

  const handleNotificationChange = (key: string) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as ThemeName);
  };

  if (!puckContent) {
    return <div>Loading...</div>;
  }

  return (
    <PuckPageRenderer content={puckContent}>
      {/* Business logic: Theme selector and preferences */}
      <div key="theme-settings" className="settings-section">
        <h3>Theme</h3>
        <select value={currentTheme} onChange={handleThemeChange}>
          <option value="dark-pro">Dark Pro</option>
          <option value="luxury-minimal">Luxury Minimal</option>
          <option value="warm-community">Warm & Community</option>
        </select>
      </div>

      <div key="notification-settings" className="settings-section">
        <h3>Notifications</h3>
        <label>
          <input
            type="checkbox"
            checked={notifications.taskDueSoon}
            onChange={() => handleNotificationChange('taskDueSoon')}
          />
          Task due soon
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.taskCompleted}
            onChange={() => handleNotificationChange('taskCompleted')}
          />
          Task completed
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.taskAssigned}
            onChange={() => handleNotificationChange('taskAssigned')}
          />
          Task assigned
        </label>
        <label>
          <input
            type="checkbox"
            checked={notifications.weeklyDigest}
            onChange={() => handleNotificationChange('weeklyDigest')}
          />
          Weekly digest
        </label>
      </div>
    </PuckPageRenderer>
  );
}
