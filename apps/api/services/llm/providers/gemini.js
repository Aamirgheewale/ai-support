const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiProvider {
    constructor(apiKey, model = 'gemini-1.5-flash') {
        this.client = new GoogleGenerativeAI(apiKey);
        this.model = this.client.getGenerativeModel({ model });
    }

    async generateResponse(messages) {
        try {
            // Convert standard messages to Gemini format
            // Standard: [{ role: 'user'|'assistant'|'system', content: '...' }]
            // Gemini: [{ role: 'user'|'model', parts: [{ text: '...' }] }]

            const contents = messages.map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }));

            // Filter out system messages if Gemini doesn't support them directly in history (it supports systemInstruction but simplistic mapping is safer for now)
            // For now, we'll prepend system messages to the first user message or use systemInstruction if init'd

            const result = await this.model.generateContent({
                contents: contents,
            });

            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini Generation Error:', error);
            throw error;
        }
    }
}

module.exports = GeminiProvider;
