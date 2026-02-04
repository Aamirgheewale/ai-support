import React from 'react'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string
}

export default function Skeleton({ className = '', ...props }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md ${className}`}
            {...props}
        />
    )
}
