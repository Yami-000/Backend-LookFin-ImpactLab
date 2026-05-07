import { chatWithOllama } from './ollamaClient.js';
import { validateQuery } from './securityAgent.js';
import { determineSpecializedAgent } from './specializedAgents.js';
import { createResponseAgent } from './responseAgent.js';

const GENERAL_AGENT_SYSTEM_PROMPT = `Eres LookFin, un asesor financiero experto, claro y prudente.
Ayudas a personas con consultas sobre finanzas personales, presupuesto, ahorro, inversión, beneficios sociales.

Tu trabajo es:
1. Entender la intención del usuario
2. Si la consulta es clara y específica, responde directamente
3. Si es genérica o compleja, reconoce cuándo necesitas información adicional
4. Siempre mantén respuestas concisas y prácticas
5. Sé empático y orientado a soluciones

Responde en español, de forma clara y directa.`;

export const createGeneralAgent = (host, model) => {
  return {
    async respond(query, context = []) {
      const response = await chatWithOllama({
        host,
        model,
        messages: [...context, { role: 'user', content: query }],
      });
      return response.trim();
    },
  };
};

/**
 * Orquestador principal del sistema de agentes
 */
export const createAgentOrchestrator = (host, model) => {
  return {
    host,
    model,

    async processQuery(userQuery) {
      const result = {
        query: userQuery,
        steps: [],
        validation: null,
        response: null,
        agentUsed: null,
      };

      // PASO 1: Validar consulta con agente de seguridad
      console.log('[Validando consulta...]');
      result.steps.push('security_validation');

      result.validation = await validateQuery(userQuery, this.host, this.model);

      if (!result.validation.valida) {
        result.response = `No puedo procesar tu consulta porque: ${result.validation.razon}`;
        return result;
      }

      // PASO 2: Determinar qué agente usar
      console.log('Consulta validada. Procesando...\n');
      result.steps.push('agent_routing');

      const specializedAgent = determineSpecializedAgent(userQuery);

      const responseAgent = createResponseAgent(this.host, this.model);

      if (specializedAgent) {
        // PASO 3a: Usar agente especializado y luego pasar su resultado al agente de respuesta
        result.agentUsed = specializedAgent.name;
        result.steps.push(specializedAgent.name);

        const agentResponse = await specializedAgent.respond(
          userQuery,
          chatWithOllama,
          this.host,
          this.model,
        );

        // agentResponse.response contiene la salida del agente especializado
        const finalAnswer = await responseAgent.respond(userQuery, agentResponse.response);
        result.response = finalAnswer;
      } else {
        // PASO 3b: No hay agente especializado — pasar la consulta directamente al agente de respuesta
        result.agentUsed = 'agente_de_respuesta';
        result.steps.push('agente_de_respuesta');

        const finalAnswer = await responseAgent.respond(userQuery, null);
        result.response = finalAnswer;
      }

      return result;
    },
  };
};
