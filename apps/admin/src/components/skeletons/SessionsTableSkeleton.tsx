import React from 'react'
import { Card, TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '../ui'
import Skeleton from '../ui/Skeleton'

export default function SessionsTableSkeleton() {
    return (
        <Card className="overflow-hidden">
            <TableContainer>
                <Table>
                    <Thead>
                        <Tr>
                            <Th className="w-10"><Skeleton className="h-4 w-4" /></Th>
                            <Th><Skeleton className="h-4 w-20" /></Th>
                            <Th><Skeleton className="h-4 w-16" /></Th>
                            <Th><Skeleton className="h-4 w-20" /></Th>
                            <Th><Skeleton className="h-4 w-24" /></Th>
                            <Th><Skeleton className="h-4 w-24" /></Th>
                            <Th className="w-32"><Skeleton className="h-4 w-12" /></Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Tr key={i}>
                                <Td><Skeleton className="h-4 w-4" /></Td>
                                <Td><Skeleton className="h-4 w-24" /></Td>
                                <Td><Skeleton className="h-6 w-16 rounded-full" /></Td>
                                <Td><Skeleton className="h-4 w-20" /></Td>
                                <Td><Skeleton className="h-4 w-32" /></Td>
                                <Td><Skeleton className="h-4 w-32" /></Td>
                                <Td><Skeleton className="h-8 w-16" /></Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </TableContainer>
        </Card>
    )
}
