import {
    AreaChart,
    Card,
    DonutChart,
    Grid,
    Metric,
    Subtitle,
    Text,
    Title,
    Flex,
    Col
} from '@tremor/react';
import { ColumnDef } from '@tanstack/react-table';
import { Activity, CheckCircle, Eye, Ticket, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import DashboardSkeleton from '../components/ui/DashboardSkeleton';
import DataTable from '../components/ui/DataTable';

// Chart value formatter
const dataFormatter = (number: number) => {
    return Intl.NumberFormat('us').format(number).toString();
};

interface DashboardStats {
    kpi: {
        activeSessions: number;
        pendingTickets: number;
        resolvedSessions: number;
        agentsOnline: number;
        aiAccuracy: number;
    };
    charts: {
        weeklyVolume: {
            date: string;
            Sessions: number;
            Tickets: number;
        }[];
        topAgents: any[];
    };
    recentActivity: any[];
}

export default function Dashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Only fetch once
        const fetchStats = async () => {
            try {
                const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
                const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

                const response = await fetch(`${API_BASE}/admin/dashboard/stats`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch dashboard stats');
                }

                const data = await response.json();
                setStats(data);
            } catch (err: any) {
                console.error('Dashboard fetch error:', err);
                setError(err.message || 'Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Define columns for Agent Leaderboard
    const dashboardColumns: ColumnDef<any>[] = [
        {
            accessorKey: 'name',
            header: 'Agent Name',
            cell: info => <span className="font-medium text-gray-900 dark:text-white">{String(info.getValue())}</span>,
        },
        {
            accessorKey: 'sessionsClosed',
            header: 'Sessions Closed',
            cell: info => info.getValue(),
        },
        {
            accessorKey: 'queriesResolved',
            header: 'Query Resolved',
            cell: info => info.getValue(),
        },
        {
            id: 'actions',
            header: '',
            cell: () => (
                <div className="flex justify-end">
                    <button
                        onClick={() => console.log('View agent details')}
                        className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ];

    if (loading) {
        return <DashboardSkeleton />;
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <Title className="text-red-700 dark:text-red-400">Error Loading Dashboard</Title>
                    <Text className="text-red-600 dark:text-red-300">{error}</Text>
                </div>
            </div>
        );
    }

    const data = stats || {
        kpi: {
            activeSessions: 0,
            pendingTickets: 0,
            resolvedSessions: 0,
            agentsOnline: 0,
            aiAccuracy: 0
        },
        charts: {
            weeklyVolume: [],
            topAgents: []
        },
        recentActivity: []
    };

    const kpiData = [
        {
            title: "Active Sessions",
            metric: data.kpi.activeSessions,
            icon: Activity,
            color: "blue",
        },
        {
            title: "Pending Tickets",
            metric: data.kpi.pendingTickets,
            icon: Ticket,
            color: "amber",
        },
        {
            title: "Agents Online",
            metric: data.kpi.agentsOnline,
            icon: Users,
            color: "emerald",
        },
        {
            title: "AI Accuracy",
            metric: `${data.kpi.aiAccuracy}%`,
            icon: CheckCircle,
            color: "purple",
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen"
        >
            <div>
                <Title>Executive Dashboard</Title>
                <Text>Real-time overview of support performance.</Text>
            </div>

            {/* Top Row: KPIs */}
            <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
                {kpiData.map((item) => (
                    <Card key={item.title} decoration="top" decorationColor={item.color as any} className="relative overflow-hidden">
                        <Flex justifyContent="start" alignItems="center" className="space-x-4">
                            <div className={`p-2 rounded-lg bg-${item.color}-100 dark:bg-${item.color}-900/20`}>
                                <item.icon className={`h-6 w-6 text-${item.color}-600 dark:text-${item.color}-500`} />
                            </div>
                            <div>
                                <Text className="truncate">{item.title}</Text>
                                <Metric>{item.metric}</Metric>
                            </div>
                        </Flex>
                    </Card>
                ))}
            </Grid>

            {/* Middle Row: Charts */}
            <Grid numItems={1} numItemsLg={3} className="gap-6">
                {/* Traffic Trends */}
                <Col numColSpan={1} numColSpanLg={2}>
                    <Card>
                        <Title>Traffic Trends</Title>
                        <Subtitle>Incoming sessions vs tickets over the last 7 days</Subtitle>
                        <AreaChart
                            className="mt-6 h-72"
                            data={data.charts.weeklyVolume}
                            index="date"
                            categories={["Sessions", "Tickets"]}
                            colors={["blue", "amber"]}
                            valueFormatter={dataFormatter}
                            yAxisWidth={40}
                            showAnimation={true}
                        />
                    </Card>
                </Col>

                {/* Session Status */}
                <Card>
                    <Title>Session Status</Title>
                    <Subtitle>Current workload distribution</Subtitle>
                    <DonutChart
                        className="mt-6 h-64"
                        data={[
                            { name: "Active", value: data.kpi.activeSessions },
                            { name: "Pending", value: data.kpi.pendingTickets },
                            { name: "Resolved", value: data.kpi.resolvedSessions ?? 0 }
                        ]}
                        category="value"
                        index="name"
                        valueFormatter={dataFormatter}
                        colors={["blue", "amber", "emerald"]}
                        showAnimation={true}
                    />
                </Card>
            </Grid>

            {/* Bottom Row: Advanced Table (Top Agents) */}
            <Card className="p-0 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                    <Title>Agent Leaderboard</Title>
                    <Subtitle>Top performing agents by sessions closed</Subtitle>
                </div>
                <div className="p-4">
                    <DataTable
                        columns={dashboardColumns}
                        data={data.charts.topAgents}
                        isLoading={false}
                        showPagination={true}
                    />
                </div>
            </Card>

        </motion.div>
    );
}
