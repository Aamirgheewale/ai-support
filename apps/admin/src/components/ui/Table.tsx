import React, { ReactNode, HTMLAttributes } from 'react'

// Base props interface for all table components
interface BaseTableProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  className?: string
}

/**
 * TableContainer - Wrapper for table with overflow handling
 */
export function TableContainer({ children, className = '' }: BaseTableProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Table - Main table element with dark mode support
 */
export function Table({ children, className = '' }: BaseTableProps) {
  return (
    <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
      {children}
    </table>
  )
}

/**
 * Thead - Table header with dark mode background
 */
export function Thead({ children, className = '' }: BaseTableProps) {
  return (
    <thead className={`bg-gray-50 dark:bg-gray-900 ${className}`}>
      {children}
    </thead>
  )
}

/**
 * Th - Table header cell with dark mode text color
 */
export function Th({ children, className = '', ...props }: BaseTableProps & HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${className}`} {...props}>
      {children}
    </th>
  )
}

/**
 * Tbody - Table body with dark mode background
 */
export function Tbody({ children, className = '' }: BaseTableProps) {
  return (
    <tbody className={`bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
      {children}
    </tbody>
  )
}

/**
 * Tr - Table row with hover effect
 */
export function Tr({ children, className = '', ...props }: BaseTableProps & HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${className}`} {...props}>
      {children}
    </tr>
  )
}

/**
 * Td - Table data cell with dark mode text color
 */
export function Td({ children, className = '', ...props }: BaseTableProps & HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${className}`} {...props}>
      {children}
    </td>
  )
}
