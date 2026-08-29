/**
 * DraggableItem Component
 * Wraps list items to enable drag-and-drop reordering
 */

import React from 'react';

interface DraggableItemProps {
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  onDragLeave: () => void;
  children: React.ReactNode;
  className?: string;
}

export const DraggableItem: React.FC<DraggableItemProps> = ({
  index,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragLeave,
  children,
  className = '',
}) => {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDragEnd();
      }}
      className={`
        ${className}
        ${isDragging ? 'dragging-item' : ''}
        ${isDragOver ? 'drag-over' : ''}
        transition-all duration-200
      `}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
        transform: isDragging ? 'scale(0.95)' : 'scale(1)',
      }}
    >
      {children}
    </div>
  );
};
