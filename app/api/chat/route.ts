import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages, allHistory } = await req.json();

    // Build context summary from past conversations
    let historyContext = '';
    if (allHistory && allHistory.length > 0) {
      const pastConversations = allHistory
        .slice(0, 10) // max 10 conversations
        .map((conv: { title: string; messages: { role: string; content: string }[] }) => {
          const summary = conv.messages
            .slice(0, 4) // first 4 messages per convo
            .map((m: { role: string; content: string }) =>
              `${m.role === 'user' ? 'Utilisateur' : 'Assistant'}: ${m.content.slice(0, 200)}`
            )
            .join('\n');
          return `Conversation "${conv.title}":\n${summary}`;
        })
        .join('\n\n');

      historyContext = `
Voici un résumé des conversations passées de l'utilisateur. Utilise ces informations pour personnaliser tes réponses, te souvenir de ses préférences, son niveau technique, ses centres d'intérêt, et adapter ton ton en conséquence :

${pastConversations}

---
`;
    }

    const systemPrompt = `${historyContext}Tu es un assistant IA intelligent, utile et concis. Tu réponds en français par défaut sauf si l'utilisateur écrit dans une autre langue. Tu t'adaptes au niveau et au style de l'utilisateur.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.content,
          })),
        ],
      }),
    });

    const data = await response.json();
    return NextResponse.json({ reply: data.choices[0].message.content });
  } catch (error) {
    console.error('Groq API error:', error);
    return NextResponse.json({ reply: 'Erreur lors de la communication avec Groq.' }, { status: 500 });
  }
}