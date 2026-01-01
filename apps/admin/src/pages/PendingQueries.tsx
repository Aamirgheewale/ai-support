import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams } from 'react-router-dom';
import Toast from '../components/common/Toast';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

interface Ticket {
  $id: string;
  ticketId: string;
  name: string;
  email: string;
  mobile?: string;
  query: string;
  sessionId?: string;
  status: 'pending' | 'resolved';
  createdAt?: string;
  $createdAt?: string; // Appwrite auto-generated timestamp
  resolvedAt?: string;
  resolutionResponse?: string;
  resolvedBy?: string; // userId
  resolvedByName?: string; // User name who resolved
  resolvedByEmail?: string; // User email who resolved
  assignedAgentId?: string; // Assigned agent userId
  assignedAgentName?: string; // Assigned agent name
}

export default function PendingQueries() {
  const { hasRole, user } = useAuth();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'pending'; // Default to 'pending'

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Filter tickets based on URL query parameter
  const filteredTickets = useMemo(() => {
    if (statusFilter === 'resolved') {
      return tickets.filter(ticket => ticket.status === 'resolved');
    } else {
      return tickets.filter(ticket => ticket.status === 'pending');
    }
  }, [tickets, statusFilter]);

  // Dynamic page title
  const pageTitle = statusFilter === 'resolved' ? 'Resolved Tickets' : 'Pending Tickets';
  const pageDescription = statusFilter === 'resolved'
    ? 'View and manage resolved support tickets'
    : 'Manage and respond to pending customer support tickets';

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE}/api/tickets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      setTickets(data.tickets || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      setError(err?.message || 'Failed to load tickets');
      setToast({ message: 'Failed to load tickets', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setReplyMessage('');
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) {
      setToast({ message: 'Please enter a reply message', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE}/api/tickets/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticketId: selectedTicket.ticketId,
          userEmail: selectedTicket.email,
          responseMessage: replyMessage.trim(),
          originalQuery: selectedTicket.query
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send reply');
      }

      const result = await response.json();

      // Update ticket status locally
      setTickets(prev => prev.map(t =>
        t.ticketId === selectedTicket.ticketId
          ? {
            ...t,
            status: 'resolved' as const,
            resolvedAt: new Date().toISOString(),
            resolutionResponse: replyMessage.trim(),
            resolvedBy: user?.userId || '',
            resolvedByName: user?.name || user?.email || 'Unknown',
            resolvedByEmail: user?.email || ''
          }
          : t
      ));

      // Show appropriate message based on email status
      if (result.emailSent) {
        setToast({ message: 'Reply sent successfully and email delivered', type: 'success' });
      } else if (result.emailError) {
        setToast({
          message: `Reply saved but email failed: ${result.emailError}`,
          type: 'error'
        });
        console.error('Email delivery failed:', result.emailError);
      } else {
        setToast({ message: 'Reply sent successfully', type: 'success' });
      }

      setSelectedTicket(null);
      setReplyMessage('');
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setToast({ message: err?.message || 'Failed to send reply', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Invalid date
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getCreatedDate = (ticket: Ticket): string => {
    // Try createdAt first, then $createdAt (Appwrite auto-generated)
    return ticket.createdAt || ticket.$createdAt || '';
  };

  if (!hasRole('admin') && !hasRole('agent')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Access denied. Admin or Agent role required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
        <p className="text-sm text-gray-500 mt-1">{pageDescription}</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading tickets...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">No {statusFilter} tickets found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="w-full overflow-hidden">
            <table className="min-w-full table-fixed divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session ID
                  </th>
                  <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned Agent
                  </th>
                  {statusFilter === 'resolved' && (
                    <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resolved Agent
                    </th>
                  )}
                  <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th className="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="w-20 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  {statusFilter === 'resolved' && (
                    <th className="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resolved At
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.$id}
                    onClick={() => handleRowClick(ticket)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <span className="block truncate" title={ticket.sessionId || '-'}>
                        {ticket.sessionId || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      <span className="block truncate" title={ticket.sessionId ? (ticket.assignedAgentName || '-') : '-'}>
                        {ticket.sessionId
                          ? (ticket.assignedAgentName || '-')
                          : '-'
                        }
                      </span>
                    </td>
                    {statusFilter === 'resolved' && (
                      <td className="px-4 py-4 text-sm text-gray-500">
                        <span className="block truncate" title={ticket.resolvedByName || ticket.resolvedBy || '-'}>
                          {ticket.resolvedByName || ticket.resolvedBy || '-'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <span className="block truncate" title={ticket.name}>
                        {ticket.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      <span className="block truncate" title={ticket.email}>
                        {ticket.email}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${ticket.status === 'resolved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500">
                      {formatDate(getCreatedDate(ticket))}
                    </td>
                    {statusFilter === 'resolved' && (
                      <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(ticket.resolvedAt)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reply Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedTicket.status === 'resolved' ? 'Query Details' : 'Reply to Query'}
                </h2>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-900">
                    {selectedTicket.name}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-900">
                    {selectedTicket.email}
                  </div>
                </div>

                {selectedTicket.mobile && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                    <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-900">
                      {selectedTicket.mobile}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Query</label>
                  <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedTicket.query}
                  </div>
                </div>

                {selectedTicket.status === 'resolved' && selectedTicket.resolutionResponse && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Response</label>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md text-sm text-gray-900 whitespace-pre-wrap">
                      {selectedTicket.resolutionResponse}
                    </div>
                    <div className="mt-2 space-y-1">
                      {selectedTicket.resolvedAt && (
                        <div className="text-xs text-gray-500">
                          Resolved on: {formatDate(selectedTicket.resolvedAt)}
                        </div>
                      )}
                      {selectedTicket.resolvedByName && (
                        <div className="text-xs text-gray-500">
                          Query resolved by agent: <span className="font-medium text-gray-700">{selectedTicket.resolvedByName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedTicket.status === 'pending' ? (
                <form onSubmit={handleReplySubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Response <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      required
                      rows={6}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Enter your response here..."
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !replyMessage.trim()}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

