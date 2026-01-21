const Anthropic = require('@anthropic-ai/sdk');

class AnthropicProvider {
    constructor(apiKey, model = 'claude-3-opus-20240229') {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    async generateResponse(messages) {
        try {
            // Anthropic requires system message to be separate
            let system = '';
            const anthropicMessages = messages.filter(msg => {
                if (msg.role === 'system') {
                    system += msg.content + '\n';
                    return false;
                }
                return true;
            });

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 1024,
                system: system || undefined,
                messages: anthropicMessages,
            });

            return response.content[0].text;
        } catch (error) {
            console.error('Anthropic Generation Error:', error);
            throw error;
        }
    }
}

module.exports = AnthropicProvider;
