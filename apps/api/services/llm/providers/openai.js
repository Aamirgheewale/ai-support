const OpenAI = require('openai');

class OpenAIProvider {
    constructor(apiKey, model = 'gpt-4o') {
        this.client = new OpenAI({ apiKey });
        this.model = model;
    }

    async generateResponse(messages) {
        try {
            // Standard messages map directly to OpenAI format
            const completion = await this.client.chat.completions.create({
                messages: messages,
                model: this.model,
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI Generation Error:', error);
            throw error;
        }
    }
}

module.exports = OpenAIProvider;
