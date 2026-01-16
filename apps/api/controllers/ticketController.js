const {
    awDatabases,
    Query,
    resend,
    config
} = require('../config/clients');

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_SESSIONS_COLLECTION_ID,
} = config;

// Collection Names
const APPWRITE_TICKETS_COLLECTION_ID = 'tickets';
// const APPWRITE_CANNED_RESPONSES_COLLECTION_ID = 'canned_responses'; // If used later

const { getUserById } = require('./authController');

// Create Ticket
const createTicket = async (req, res) => {
    try {
        const { name, email, mobile, query, sessionId } = req.body;
        const io = req.app.get('io');

        // Validation
        if (!name || !email || !query) {
            return res.status(400).json({ error: 'Name, email, and query are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const { ID } = require('node-appwrite');
        const ticketId = ID.unique();

        const ticketData = {
            ticketId,
            name,
            email,
            mobile: mobile || '',
            query,
            sessionId: sessionId || null,
            status: 'pending'
        };

        await awDatabases.createDocument(
            APPWRITE_DATABASE_ID,
            APPWRITE_TICKETS_COLLECTION_ID,
            ticketId,
            ticketData
        );

        console.log(`✅ Ticket created: ${ticketId} for ${email}`);

        // Emit to admin feed
        if (io) {
            io.to('admin_feed').emit('ticket_created', {
                ticketId,
                name,
                email,
                query,
                sessionId: sessionId || null,
                timestamp: new Date().toISOString()
            });
        }

        // Send acknowledgment email
        if (resend) {
            try {
                await resend.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'internships@vtu.ac.in',
                    to: email,
                    subject: `We received your query [${ticketId}]`,
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Thank you for contacting us!</h2>
              <p>Hi ${name},</p>
              <p>We have received your query and noted it down. Our team will get back to you soon.</p>
              <p><strong>Ticket ID:</strong> ${ticketId}</p>
              <p><strong>Your Query:</strong></p>
              <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                ${query.replace(/\n/g, '<br>')}
              </div>
              <p>Best regards,<br>VTU Internyet Portal Support Team</p>
            </div>
          `
                });
                console.log(`✅ Acknowledgment email sent to ${email}`);
            } catch (emailErr) {
                console.error('❌ Failed to send acknowledgment email:', emailErr?.message || emailErr);
            }
        }

        res.json({
            success: true,
            ticketId,
            message: 'Ticket created successfully'
        });
    } catch (err) {
        console.error('Error creating ticket:', err);
        res.status(500).json({ error: err?.message || 'Failed to create ticket' });
    }
};

// List Tickets
const getTickets = async (req, res) => {
    try {
        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        let result;
        // Try using $createdAt or createdAt
        try {
            if (Query) {
                try {
                    result = await awDatabases.listDocuments(
                        APPWRITE_DATABASE_ID,
                        APPWRITE_TICKETS_COLLECTION_ID,
                        [Query.orderDesc('$createdAt')],
                        1000
                    );
                } catch (err) {
                    try {
                        result = await awDatabases.listDocuments(
                            APPWRITE_DATABASE_ID,
                            APPWRITE_TICKETS_COLLECTION_ID,
                            [Query.orderDesc('createdAt')],
                            1000
                        );
                    } catch (err2) {
                        result = await awDatabases.listDocuments(
                            APPWRITE_DATABASE_ID,
                            APPWRITE_TICKETS_COLLECTION_ID,
                            [],
                            1000
                        );
                    }
                }
            } else {
                result = await awDatabases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_TICKETS_COLLECTION_ID, undefined, 1000);
            }

            // Client-side sort fallback
            result.documents.sort((a, b) => {
                const dateA = new Date(a.$createdAt || a.createdAt || a.updatedAt || a.$updatedAt || 0).getTime();
                const dateB = new Date(b.$createdAt || b.createdAt || b.updatedAt || b.$updatedAt || 0).getTime();
                return dateB - dateA;
            });
        } catch (err) {
            console.error('Error fetching tickets:', err);
            result = await awDatabases.listDocuments(APPWRITE_DATABASE_ID, APPWRITE_TICKETS_COLLECTION_ID, [], 1000);
            result.documents.sort((a, b) => {
                const dateA = new Date(a.$createdAt || a.createdAt || 0).getTime();
                const dateB = new Date(b.$createdAt || b.createdAt || 0).getTime();
                return dateB - dateA;
            });
        }

        // Enrich tickets
        const enrichedTickets = await Promise.all(
            result.documents.map(async (ticket) => {
                let enrichedTicket = { ...ticket };

                if (ticket.resolvedBy) {
                    try {
                        const resolvedByUser = await getUserById(ticket.resolvedBy);
                        if (resolvedByUser) {
                            enrichedTicket.resolvedByName = resolvedByUser.name || resolvedByUser.email || 'Unknown';
                            enrichedTicket.resolvedByEmail = resolvedByUser.email || '';
                        }
                    } catch (err) { }
                }

                if (ticket.sessionId && APPWRITE_SESSIONS_COLLECTION_ID) {
                    try {
                        const session = await awDatabases.getDocument(
                            APPWRITE_DATABASE_ID,
                            APPWRITE_SESSIONS_COLLECTION_ID,
                            ticket.sessionId
                        );
                        if (session) {
                            let assignedAgentId = session.assignedAgent || null;
                            let assignedAgentName = null;

                            if (!assignedAgentId && session.userMeta) {
                                try {
                                    const userMeta = typeof session.userMeta === 'string' ? JSON.parse(session.userMeta) : session.userMeta;
                                    assignedAgentId = userMeta.assignedAgent || null;
                                    assignedAgentName = userMeta.assignedAgentName || null;
                                } catch (e) { }
                            }

                            if (assignedAgentId && !assignedAgentName) {
                                try {
                                    const agentUser = await getUserById(assignedAgentId);
                                    if (agentUser) assignedAgentName = agentUser.name || agentUser.email || assignedAgentId;
                                } catch (err) { assignedAgentName = assignedAgentId; }
                            }
                            enrichedTicket.assignedAgentId = assignedAgentId;
                            enrichedTicket.assignedAgentName = assignedAgentName;
                        }
                    } catch (err) { }
                }
                return enrichedTicket;
            })
        );

        res.json({
            tickets: enrichedTickets,
            total: result.total || enrichedTickets.length
        });
    } catch (err) {
        console.error('Error fetching tickets:', err);
        res.status(500).json({ error: err?.message || 'Failed to fetch tickets' });
    }
};

// Reply to Ticket
const replyToTicket = async (req, res) => {
    try {
        const { ticketId, userEmail, responseMessage, originalQuery } = req.body;

        if (!ticketId || !userEmail || !responseMessage) {
            return res.status(400).json({ error: 'ticketId, userEmail, and responseMessage are required' });
        }

        if (!awDatabases || !APPWRITE_DATABASE_ID) {
            return res.status(503).json({ error: 'Appwrite not configured' });
        }

        const now = new Date().toISOString();
        try {
            await awDatabases.updateDocument(
                APPWRITE_DATABASE_ID,
                APPWRITE_TICKETS_COLLECTION_ID,
                ticketId,
                {
                    status: 'resolved',
                    resolvedAt: now,
                    resolutionResponse: responseMessage,
                    resolvedBy: req.user.userId
                }
            );
            console.log(`✅ Ticket ${ticketId} updated to resolved`);
        } catch (updateErr) {
            if (updateErr.code === 404) return res.status(404).json({ error: 'Ticket not found' });
            throw updateErr;
        }

        if (!resend) {
            console.error('❌ Resend client not initialized');
        } else {
            try {
                const fromEmail = process.env.RESEND_FROM_EMAIL || 'internships@vtu.ac.in';
                const emailResult = await resend.emails.send({
                    from: fromEmail,
                    to: userEmail,
                    subject: 'Response to your query',
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Response to your query</h2>
              <p>Hello,</p>
              <p>Thank you for contacting us. Here is our response to your query:</p>
              
              <div style="background: #e8f4f8; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #1976D2;">Our Response:</h3>
                <div style="color: #333; line-height: 1.6;">
                  ${responseMessage.replace(/\n/g, '<br>')}
                </div>
              </div>
              
              ${originalQuery ? `
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #666;">Your Original Query:</h3>
                  <div style="color: #333; line-height: 1.6;">
                    ${originalQuery.replace(/\n/g, '<br>')}
                  </div>
                </div>
              ` : ''}
              
              <p>If you have any further questions, please don't hesitate to reach out.</p>
              <p>Best regards,<br>VTU Internyet Portal Support Team</p>
            </div>
          `
                });

                if (emailResult?.error) throw new Error(emailResult.error.message);
                console.log(`✅ Reply email sent successfully to ${userEmail}`);
            } catch (emailErr) {
                console.error('❌ Failed to send reply email:', emailErr.message);
                return res.status(500).json({ error: 'Failed to send email: ' + emailErr.message });
            }
        }

        res.json({ success: true, message: 'Reply sent and ticket resolved' });
    } catch (err) {
        console.error('Error in replyToTicket:', err);
        res.status(500).json({ error: err?.message || 'Internal server error' });
    }
};

module.exports = {
    createTicket,
    getTickets,
    replyToTicket
};
