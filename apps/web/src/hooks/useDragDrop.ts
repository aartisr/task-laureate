/**
 * useDragDrop Hook
 * Custom drag-and-drop implementation using native HTML5 API
 */

import { useState, useCallback } from 'react';

export interface DragItem<T> {
  id: string;
  data: T;
  index: number;
}

interface UseDragDropOptions<T> {
  onReorder?: (items: T[]) => void;
}

export const useDragDrop = <T extends { id: string }>(
  initialItems: T[],
  options: UseDragDropOptions<T> = {}
) => {
  const [items, setItems] = useState(initialItems);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null) {
      const newItems = [...items];
      const [draggedItem] = newItems.splice(draggedIndex, 1);
      newItems.splice(dragOverIndex, 0, draggedItem);
      setItems(newItems);
      options.onReorder?.(newItems);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, items, options]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  return {
    items,
    setItems,
    draggedIndex,
    dragOverIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragLeave,
  };
};
