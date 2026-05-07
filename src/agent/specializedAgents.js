/**
 * Agentes especializados para enrutar consultas específicas
 */

const createSpecializedAgent = (name, systemPrompt) => ({
  name,
  systemPrompt,
  async respond(query, chatWithOllama, host, model) {
    const response = await chatWithOllama({
      host,
      model,
      systemPrompt: systemPrompt,
      messages: [{ role: 'user', content: query }],
    });
    return {
      tool: name,
      status: 'completed',
      response: response.trim(),
    };
  },
});

// Agente para consultas de base de datos
export const agenteBD = createSpecializedAgent(
  'llamar_agente_bd',
  `Eres un agente especializado en consultas de bases de datos.
Tu rol es ayudar a recuperar información almacenada: historiales, registros, saldos, movimientos.
Responde de forma clara y estructurada.
Si la información no está disponible, explica qué datos se necesitarían.`,
);

// Agente clasificador de gastos e ingresos
export const agenteClasificador = createSpecializedAgent(
  'llamar_agente_clasificador_gastos_e_ingresos',
  `Eres un experto en clasificación de gastos e ingresos.
Tu rol es analizar cartolas, resumir flujos de dinero, detectar patrones de consumo.
Distingue entre gastos fijos y variables, identifica oportunidades de ahorro.
Responde con análisis práctico y recomendaciones claras.`,
);

// Agente experto en beneficios sociales
export const agenteBeneficios = createSpecializedAgent(
  'llamar_agente_experto_beneficios_sociales',
  `Eres un experto en beneficios sociales, Registro Social de Hogares y apoyos estatales.
Tu rol es informar sobre beneficios disponibles, requisitos, cómo postular.
Mantente actualizado sobre ayudas vigentes.
Responde de forma empática y práctica.`,
);

// Agente experto en ahorro e inversión
export const agenteAhorroInversion = createSpecializedAgent(
  'llamar_agente_experto_en_ahorro_e_inversión',
  `Eres un asesor financiero experto en ahorro e inversión.
Tu rol es orientar sobre alternativas de ahorro, instrumentos de inversión, diversificación.
Considera el perfil de riesgo y la situación financiera del usuario.
Responde con recomendaciones claras, prácticas y responsables.`,
);

// Mapeo de intenciones a agentes especializados
export const determineSpecializedAgent = (query) => {
  const queryLower = query.toLowerCase();

  if (queryLower.match(/\b(cartola|movimiento|saldo|historial|transacción|registro|datos)\b/i)) {
    return agenteBD;
  }

  if (queryLower.match(/\b(gasto|ingreso|clasificar|presupuesto|flujo|dinero|consumo|ahorro potencial)\b/i)) {
    return agenteClasificador;
  }

  if (queryLower.match(/\b(beneficio|subsidio|ayuda|apoyo|bono|fondo|registro social)\b/i)) {
    return agenteBeneficios;
  }

  if (queryLower.match(/\b(ahorr|invert|rendimiento|interés|plan financiero|instrumento|riesgo|cartera)\b/i)) {
    return agenteAhorroInversion;
  }

  return null; // Sin agente especializado, usar agente general
};

export const allSpecializedAgents = [
  agenteBD,
  agenteClasificador,
  agenteBeneficios,
  agenteAhorroInversion,
];
