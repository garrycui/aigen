import axios from 'axios';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function generateChatResponse(
  prompt: string,
  chatHistory: { role: string; content: string }[],
  mbtiType?: string,
  aiPreference?: string
): Promise<{ response: string }> {
  if (!OPENAI_API_KEY) {
    console.error('OpenAI API key not found');
    return { response: "I'm having trouble connecting right now. Please check your API key configuration." };
  }

  const systemPrompt = [
    { role: 'system', content: prompt },
    ...(mbtiType ? [{ role: 'system', content: `User MBTI: ${mbtiType}` }] : []),
    ...(aiPreference ? [{ role: 'system', content: `User AI Preference: ${aiPreference}` }] : []),
  ];

  const messages = [...systemPrompt, ...chatHistory];

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-4o',
        messages,
        max_tokens: 256,
        temperature: 0.7,
        presence_penalty: 0.6,
        frequency_penalty: 0.5,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    const aiResponse = response.data.choices?.[0]?.message?.content?.trim();
    if (!aiResponse) {
      return { response: "I'm having trouble forming a response right now. Could you try again?" };
    }
    return { response: aiResponse };
  } catch (error: any) {
    console.error('OpenAI API error:', error?.response?.data || error.message);
    if (error.code === 'ECONNABORTED') {
      return { response: "I'm taking a bit longer to think than usual. Could you try again?" };
    }
    if (error?.response?.status === 401) {
      return { response: "There's an authentication issue with my AI brain. Please check the API configuration." };
    }
    if (error?.response?.status === 429) {
      return { response: "I'm a bit overwhelmed with requests right now. Could you try again in a moment?" };
    }
    return { response: "I encountered an unexpected hiccup. Could you try asking me again? 🤔" };
  }
}

/**
 * Call OpenAI to analyze chat history and extract user insights and suggested questions.
 * Returns a parsed JSON object as described in the prompt.
 */
export async function getUserInsightsFromOpenAI(prompt: string): Promise<any> {
  if (!OPENAI_API_KEY) {
    console.error('OpenAI API key not found');
    return {};
  }
  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a helpful assistant for user profiling and personalized question generation.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.3,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        timeout: 30000,
      }
    );
    // Try to parse JSON from the response
    const text = response.data.choices?.[0]?.message?.content?.trim();
    if (!text) return {};
    // Find the first JSON object in the response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    // Fallback: try to parse the whole text
    return JSON.parse(text);
  } catch (error: any) {
    console.error('OpenAI user insights error:', error?.response?.data || error.message);
    return {};
  }
}