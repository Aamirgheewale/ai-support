import React, { ReactNode } from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/**
 * Card - Reusable card component with dark mode support
 * Light Mode: White background with gray border
 * Dark Mode: Dark gray background with darker border
 */
export default function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm rounded-lg ${className}`} {...props}>
      {children}
    </div>
  )
}
