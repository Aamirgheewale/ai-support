const {
    awDatabases,
    config,
    encryption
} = require('../../config/clients'); // Adjust path as needed

const {
    APPWRITE_DATABASE_ID,
    APPWRITE_LLM_SETTINGS_COLLECTION_ID
} = config;

const axios = require('axios');

const settingsService = require('../settingsService');
const { Query } = require('node-appwrite');

/**
 * Get the AI client dynamically based on current configuration.
 * Falls back to environment variables if database config is missing.
 * @returns {Promise<{client: any, provider: string, modelName: string}>}
 */
async function getClient() {
    try {
        let config = {
            provider: process.env.AI_PROVIDER || 'gemini',
            apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
            modelName: process.env.AI_MODEL || 'gemini-2.0-flash-exp',
            baseUrl: process.env.AI_BASE_URL
        };

        // 1. Try to get ACTIVE config from DB
        if (awDatabases) {
            try {
                const result = await awDatabases.listDocuments(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
                    [
                        Query.equal('isActive', true),
                        Query.limit(1)
                    ]
                );

                if (result.documents.length > 0) {
                    const doc = result.documents[0];
                    let apiKey = doc.encryptedApiKey;

                    // Decrypt if possible
                    if (encryption && apiKey) {
                        try {
                            apiKey = encryption.decrypt(apiKey);
                        } catch (err) {
                            console.error('Failed to decrypt API key, using as-is', err);
                        }
                    }

                    config = {
                        provider: doc.provider,
                        apiKey: apiKey,
                        modelName: doc.model,
                        baseUrl: doc.baseUrl,
                        configId: doc.$id
                    };
                }
            } catch (dbError) {
                console.warn('⚠️ Failed to fetch LLM config from DB, using fallback:', dbError.message);
            }
        }

        let client;
        const { provider, modelName, apiKey, baseUrl, configId } = config;

        console.log(`🤖 Initializing AI client: ${provider} (${modelName})`);

        if (!apiKey) {
            throw new Error('No API Key configured for AI service');
        }

        switch (provider) {
            case 'gemini':
            case 'google': // Handle both naming conventions
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                client = new GoogleGenerativeAI(apiKey);
                break;

            case 'openai':
            case 'custom':
                const OpenAI = require('openai');
                // Ensure baseUrl is undefined if null/empty string for OpenAI default
                const clientConfig = { apiKey };
                if (baseUrl) {
                    clientConfig.baseURL = baseUrl;
                }

                client = new OpenAI(clientConfig);
                break;

            case 'anthropic':
                // Placeholder for Anthropic if needed later
                throw new Error('Anthropic provider not yet fully implemented in getClient');

            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }

        return { client, provider, modelName, configId };
    } catch (error) {
        console.error('❌ Failed to initialize AI client:', error.message);

        // Fallback to environment variables (backwards compatibility logic is now integrated above, but as a last resort catch we can re-try hardcoded defaults if above failed totally)

        // ... Original fallback logic was to restart, but we integrated it. 
        // If we threw error above, it means even env vars failed or key was missing.
        throw error;
    }
}


/**
 * Helper function to download an image from a URL and convert it to base64
 * @param {string} url - The image URL (typically from Appwrite storage)
 * @returns {Promise<{data: string, mimeType: string}>} Base64 data and MIME type
 */
async function urlToBase64(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000 // 10 second timeout
        });

        const buffer = Buffer.from(response.data);
        const mimeType = response.headers['content-type'] || 'image/jpeg';

        return {
            data: buffer.toString('base64'),
            mimeType: mimeType
        };
    } catch (error) {
        console.error('❌ Failed to download/convert image:', error.message);
        throw new Error(`Image download failed: ${error.message}`);
    }
}

/**
 * Generate a response using the dynamically configured LLM provider.
 * @param {Array} messages - Array of { role, content } objects.
 * @param {string|null} attachmentUrl - Optional image URL for vision analysis
 * @returns {Promise<string>} The generated text.
 */
async function generateResponse(messages, attachmentUrl = null) {
    let currentConfigId = null;

    try {
        // Get dynamic client
        const { client, provider, modelName, configId } = await getClient();
        currentConfigId = configId;

        // Define language protocol for multilingual support
        const LANGUAGE_PROTOCOL = `
[SYSTEM PROTOCOL - LANGUAGE]
You must STRICTLY detect the language of the user's input and reply in the SAME language.
- English -> English
- Hindi -> Hindi
- Kannada -> Kannada
- Marathi -> Marathi
- Mixed (Hinglish/Kanglish) -> Match the dominant language/script.
`;

        // Define language enforcement suffix for user messages
        const LANGUAGE_ENFORCEMENT = `

[INSTRUCTION]
You must reply in the EXACT SAME LANGUAGE that I used in my message above.
If I typed in English, you must reply in English. If I typed in a regional language, reply in that regional language. Do not translate unless explicitly asked.
`;

        // Fetch system prompt (fails safe with default)
        const dbSystemPrompt = await settingsService.getSystemPrompt();

        // JSON output instruction — appended last so it takes highest priority
        const JSON_INSTRUCTION = `
[SYSTEM PROTOCOL - OUTPUT FORMAT]
You must ALWAYS respond with a valid JSON object. Do NOT wrap the JSON in markdown code blocks (no \`\`\`json). The JSON must have exactly two keys:
- "reply": Your actual response text to the user.
- "suggestions": An array of exactly 2 short, highly relevant follow-up questions the user might ask next based on your reply.
`;

        // Create hybrid system instruction (DB prompt + language protocol + JSON format)
        const finalSystemInstruction = dbSystemPrompt + "\n\n" + LANGUAGE_PROTOCOL + "\n\n" + JSON_INSTRUCTION;

        // Robust helper: strip markdown code blocks then JSON.parse
        // Returns { text, suggestions } or falls back to { text: rawText, suggestions: [] }
        const parseLLMResponse = (rawText) => {
            try {
                // 1. Strip markdown code blocks (```json ... ```)
                let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

                // 2. Parse the cleaned string
                const parsed = JSON.parse(cleanedText);

                return {
                    text: parsed.reply || rawText, // Fallback to raw if 'reply' key is missing
                    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
                };
            } catch (error) {
                console.error('Failed to parse LLM JSON. Falling back to raw text.', error);
                // Fallback: Treat the whole raw text as the answer so the user doesn't get an error
                return { text: rawText, suggestions: [] };
            }
        };

        // Inject language enforcement into the last user message
        const messagesWithEnforcement = messages.map((msg, idx) => {
            if (idx === messages.length - 1 && msg.role === 'user') {
                return { ...msg, content: msg.content + LANGUAGE_ENFORCEMENT };
            }
            return msg;
        });

        // TEXT-ONLY PATH (Backwards Compatible)
        if (!attachmentUrl) {
            if (provider === 'gemini' || provider === 'google') {
                // Gemini text-only
                const model = client.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    { text: finalSystemInstruction },
                    { text: messagesWithEnforcement.map(m => `${m.role}: ${m.content}`).join('\n') }
                ]);
                const response = await result.response;
                const rawText = response.text();
                return parseLLMResponse(rawText);
            } else {
                // OpenAI/Custom text-only
                const formattedMessages = [
                    { role: 'system', content: finalSystemInstruction },
                    ...messagesWithEnforcement
                ];
                // Check if client is OpenAI instance or GoogleGenerativeAI
                // Logic mismatch safeguard:
                if (client.chat && client.chat.completions) {
                    const completion = await client.chat.completions.create({
                        model: modelName,
                        messages: formattedMessages
                    });
                    const rawText = completion.choices[0].message.content;
                    return parseLLMResponse(rawText);
                } else if (client.getGenerativeModel) {
                    // Fallback if provider was mishandled but client is Gemini
                    const model = client.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([
                        { text: finalSystemInstruction },
                        { text: messagesWithEnforcement.map(m => `${m.role}: ${m.content}`).join('\n') }
                    ]);
                    const response = await result.response;
                    const rawText = response.text();
                    return parseLLMResponse(rawText);
                } else {
                    throw new Error('Invalid client initialized for provider: ' + provider);
                }
            }
        }

        // VISION PATH (Image Analysis)
        console.log('🖼️ Vision mode activated - processing image:', attachmentUrl);

        // Fetch image analysis prompt
        const imagePrompt = await settingsService.getImageAnalysisPrompt();

        // Try to download and convert image
        let imageData;
        try {
            imageData = await urlToBase64(attachmentUrl);
        } catch (imageError) {
            console.warn('⚠️ Image download failed, falling back to text-only:', imageError.message);
            // Fallback to text-only
            if (provider === 'gemini' || provider === 'google') {
                const model = client.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    { text: finalSystemInstruction },
                    { text: messagesWithEnforcement.map(m => `${m.role}: ${m.content}`).join('\n') }
                ]);
                const response = await result.response;
                const rawText = response.text();
                return parseLLMResponse(rawText);
            } else {
                if (client.chat && client.chat.completions) {
                    const formattedMessages = [
                        { role: 'system', content: finalSystemInstruction },
                        ...messagesWithEnforcement
                    ];
                    const completion = await client.chat.completions.create({
                        model: modelName,
                        messages: formattedMessages
                    });
                    const rawText = completion.choices[0].message.content;
                    return parseLLMResponse(rawText);
                } else {
                    // Fallback Gemini
                    const model = client.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([
                        { text: finalSystemInstruction },
                        { text: messagesWithEnforcement.map(m => `${m.role}: ${m.content}`).join('\n') }
                    ]);
                    const response = await result.response;
                    const rawText = response.text();
                    return parseLLMResponse(rawText);
                }
            }
        }

        // Provider-specific vision logic
        if (provider === 'gemini' || provider === 'google') {
            // Gemini Vision Logic
            const lastMessage = messagesWithEnforcement[messagesWithEnforcement.length - 1];
            const userText = lastMessage?.content || '';

            // Combine system prompt, image prompt, and user message (enforcement already in userText)
            const combinedPrompt = `${finalSystemInstruction}\n\n${imagePrompt}\n\nUser query: ${userText}`;

            // Use Gemini's multimodal API
            const model = client.getGenerativeModel({ model: modelName });
            const result = await model.generateContent([
                { text: combinedPrompt },
                {
                    inlineData: {
                        data: imageData.data,
                        mimeType: imageData.mimeType
                    }
                }
            ]);

            const response = await result.response;
            const rawText = response.text();
            return parseLLMResponse(rawText);

        } else if (provider === 'openai' || provider === 'custom') {
            // OpenAI/Custom Vision Logic
            const lastMessage = messagesWithEnforcement[messagesWithEnforcement.length - 1];
            const userText = lastMessage?.content || '';

            // Construct vision message (enforcement already in userText)
            const visionMessage = {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: `${imagePrompt}\n\n${userText}`
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${imageData.mimeType};base64,${imageData.data}`
                        }
                    }
                ]
            };

            // Replace last message with vision message
            const visionMessages = [
                { role: 'system', content: finalSystemInstruction },
                ...messagesWithEnforcement.slice(0, -1),
                visionMessage
            ];

            // Call OpenAI with vision-enabled messages
            const completion = await client.chat.completions.create({
                messages: visionMessages,
                model: modelName,
            });

            const rawText = completion.choices[0].message.content;
            return parseLLMResponse(rawText);

        } else {
            // Unsupported provider for vision - fallback to text-only
            console.warn(`⚠️ Vision not yet supported for provider: ${provider}, using text-only`);
            if (provider === 'gemini' || provider === 'google') {
                const model = client.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    { text: finalSystemInstruction },
                    { text: messagesWithEnforcement.map(m => `${m.role}: ${m.content}`).join('\n') }
                ]);
                const response = await result.response;
                const rawText = response.text();
                return parseLLMResponse(rawText);
            } else {
                const formattedMessages = [
                    { role: 'system', content: finalSystemInstruction },
                    ...messagesWithEnforcement
                ];
                const completion = await client.chat.completions.create({
                    model: modelName,
                    messages: formattedMessages
                });
                const rawText = completion.choices[0].message.content;
                return parseLLMResponse(rawText);
            }
        }

    } catch (error) {
        console.error('❌ LLM Generation Failed:', error);

        // Analyze error
        let status = 'error';
        let severity = 'error';
        let alertTitle = 'AI Service Error';
        let alertMessage = 'Service disruption detected.';

        // Detect Auth Errors (401/403 or specific strings)
        // Gemini throws GoogleGenerativeAIError usually, checking message is safest fallback
        const errMsg = error.message || '';
        if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('API key') || errMsg.includes('unauthorized') || errMsg.includes('permission denied')) {
            status = 'error';
            severity = 'critical';
            alertTitle = 'AI Critical Failure';
            alertMessage = 'API Key is invalid or expired. AI is currently offline.';
        }
        // Rate Limits
        else if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests')) {
            status = 'warning';
            severity = 'warning';
            alertTitle = 'AI Rate Limit Warning';
            alertMessage = 'LLM Rate limits reached. Service may be intermittent.';
        }

        // 1. Trigger Notification
        try {
            const { broadcastSystemAlert } = require('../notificationService');
            // Only broadcast if it's critical or warning, or if it's a hard crash? 
            // User requested alerts for these cases.
            // Target admins for all, agents for general disruptions?
            // "If Auth Error ... ['admin']. If General Error ... ['admin', 'agent']"

            const targetRoles = severity === 'critical' ? ['admin'] : ['admin', 'agent'];
            await broadcastSystemAlert(alertTitle, alertMessage, severity, targetRoles);
        } catch (notifyErr) {
            console.error('Failed to send system alert:', notifyErr);
        }

        // 2. Update DB with health status
        try {
            if (currentConfigId) {
                await awDatabases.updateDocument(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_LLM_SETTINGS_COLLECTION_ID || 'llm_settings',
                    currentConfigId,
                    {
                        healthStatus: status,
                        lastError: errMsg.substring(0, 255) // Truncate for safety
                    }
                );
                console.log(`📝 Updated LLM Settings healthStatus to: ${status}`);
            }
        } catch (dbErr) {
            console.error('Failed to update LLM health status in DB:', dbErr);
        }

        throw error; // Re-throw so chatService knows it failed
    }
}

/**
 * Get current provider info (name and model)
 * @returns {Promise<Object>} The provider info object
 */
async function getCurrentProviderInfo() {
    try {
        const { provider, modelName } = await getClient();

        // Capitalize provider name for display
        const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

        return {
            name: providerName,
            model: modelName
        };
    } catch (error) {
        console.error('Failed to get provider info:', error);
        return { name: 'Gemini', model: 'default' };
    }
}

module.exports = {
    generateResponse,
    getCurrentProviderInfo
};
