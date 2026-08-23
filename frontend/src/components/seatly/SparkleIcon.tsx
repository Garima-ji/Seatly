import React from 'react';

interface SparkleIconProps {
  size?: number;
  className?: string;
  fill?: string;
}

export default function SparkleIcon({ size = 16, className = '', fill = 'currentColor' }: SparkleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
    </svg>
  );
}
