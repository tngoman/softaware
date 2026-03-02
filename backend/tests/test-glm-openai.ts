import OpenAI from 'openai';
import 'dotenv/config';

const client = new OpenAI({
    apiKey: process.env.GLM,
    baseURL: "https://api.z.ai/api/paas/v4/"
});

async function main() {
    console.log('Testing GLM API...');
    
    const completion = await client.chat.completions.create({
        model: "glm-4.6",
        messages: [
            { role: "system", content: "You are a helpful AI assistant." },
            { role: "user", content: "Hello, please introduce yourself." }
        ]
    });

    console.log('Response:', completion.choices[0].message.content);
}

main().catch(err => console.error('Error:', err.message));
