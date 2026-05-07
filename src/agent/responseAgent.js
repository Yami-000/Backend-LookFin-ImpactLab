import { chatWithOllama } from './ollamaClient.js';

const RESPONSE_AGENT_SYSTEM_PROMPT = `Eres el agente de respuesta final llamado "agenteDeRespuesta".
Tu trabajo es recibir la información procesada por otros agentes (por ejemplo, agentes especializados)
y generar la respuesta final dirigida al usuario.

Reglas:
- Si recibes contenido generado por un agente especializado, usa ese contenido como la fuente principal y formatea la respuesta para el usuario.
- Si recibes únicamente la consulta del usuario (sin agente especializado), responde la consulta de forma clara y completa.
- Mantén el lenguaje en español, tono empático y práctico.
- Devuelve sólo la respuesta textual pensada para el usuario.
`;

export const createResponseAgent = (host, model) => ({
  async respond(userQuery, specializedAgentResult = null) {
    const messages = [];

    // System prompt to instruct the response agent
    messages.push({ role: 'system', content: RESPONSE_AGENT_SYSTEM_PROMPT });

    // If we have a specialized agent result, provide it as context
    if (specializedAgentResult) {
      messages.push({ role: 'assistant', content: specializedAgentResult });
      messages.push({ role: 'user', content: `Por favor, genera la respuesta final para la consulta: ${userQuery}` });
    } else {
      // Otherwise, respond directly to the user's query
      messages.push({ role: 'user', content: userQuery });
    }

    const assistantReply = await chatWithOllama({
      host,
      model,
      messages,
    });

    return assistantReply.trim();
  },
});
