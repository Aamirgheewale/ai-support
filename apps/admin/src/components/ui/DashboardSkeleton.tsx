import { Card, Grid, Col } from "@tremor/react";

export default function DashboardSkeleton() {
    return (
        <div className="p-6 space-y-6 animate-pulse">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded"></div>

            {/* Top Row: KPIs */}
            <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mt-6">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="h-28 bg-gray-100 dark:bg-gray-800 border-none" />
                ))}
            </Grid>

            {/* Middle Row: Charts */}
            <Grid numItems={1} numItemsLg={3} className="gap-6">
                <Col numColSpan={1} numColSpanLg={2}>
                    <Card className="h-80 bg-gray-100 dark:bg-gray-800 border-none" />
                </Col>
                <Card className="h-80 bg-gray-100 dark:bg-gray-800 border-none" />
            </Grid>

            {/* Bottom Row: Table */}
            <Card className="h-64 bg-gray-100 dark:bg-gray-800 border-none" />
        </div>
    );
}
