import React from 'react'
import Skeleton from '../ui/Skeleton'

export default function ChatSkeleton() {
    return (
        <div className="flex flex-col gap-3 p-4">
            {/* Bot message (left) */}
            <div className="self-start max-w-[70%]">
                <Skeleton className="h-16 w-64 rounded-lg" />
                <Skeleton className="h-3 w-20 mt-1" />
            </div>

            {/* User message (right) */}
            <div className="self-end max-w-[70%] flex flex-col items-end">
                <Skeleton className="h-10 w-48 rounded-lg" />
                <Skeleton className="h-3 w-16 mt-1" />
            </div>

            {/* Bot message (left) */}
            <div className="self-start max-w-[70%]">
                <Skeleton className="h-24 w-80 rounded-lg" />
                <Skeleton className="h-3 w-20 mt-1" />
            </div>

            {/* User message (right) */}
            <div className="self-end max-w-[70%] flex flex-col items-end">
                <Skeleton className="h-12 w-56 rounded-lg" />
                <Skeleton className="h-3 w-16 mt-1" />
            </div>

            {/* Bot message (left) */}
            <div className="self-start max-w-[70%]">
                <Skeleton className="h-10 w-40 rounded-lg" />
                <Skeleton className="h-3 w-20 mt-1" />
            </div>
        </div>
    )
}
