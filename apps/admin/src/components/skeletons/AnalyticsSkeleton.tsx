import React from 'react'
import { Card } from '../ui'
import Skeleton from '../ui/Skeleton'

export default function AnalyticsSkeleton() {
    return (
        <div className="p-6">
            <Skeleton className="h-8 w-64 mb-6" />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="p-4">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-8 w-16" />
                    </Card>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Large Chart */}
                <Card className="p-4 col-span-1 lg:col-span-2">
                    <Skeleton className="h-6 w-48 mb-4" />
                    <Skeleton className="h-[300px] w-full" />
                </Card>

                {/* Smaller Charts */}
                <Card className="p-4">
                    <Skeleton className="h-6 w-40 mb-4" />
                    <Skeleton className="h-[250px] w-full" />
                </Card>
                <Card className="p-4">
                    <Skeleton className="h-6 w-40 mb-4" />
                    <Skeleton className="h-[250px] w-full" />
                </Card>
            </div>
        </div>
    )
}
