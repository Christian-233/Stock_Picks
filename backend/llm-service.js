const OpenAI = require('openai');

let cachedClient = null;

function getModelName() {
  return process.env.OPENAI_MODEL || 'gpt-4.1';
}

function isOpenAIConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getClient() {
  if (!isOpenAIConfigured()) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return cachedClient;
}

function extractJson(text) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw error;
    }
    return JSON.parse(match[0]);
  }
}

function buildPrompt(context) {
  return [
    'You are a risk-aware equity analyst.',
    'Use the current market metrics, recent news, Reddit discussion, and recent forecast performance.',
    'Return only valid JSON with this shape:',
    '{"outlook":"bullish|neutral|bearish","summary":"string","signalScore":number,"confidenceAdjustment":number,"weightAdjustments":{"historicalTrend":number,"technicalSignals":number,"newsSentiment":number,"redditSentiment":number,"volatilityControl":number,"calibrationAdjustment":number}}',
    'Rules:',
    '- signalScore must be between -1 and 1.',
    '- confidenceAdjustment must be between -0.2 and 0.2.',
    '- weightAdjustments should indicate which signals matter more right now, not absolute final weights.',
    `Context: ${JSON.stringify(context)}`
  ].join('\n');
}

function normalizeAssessment(rawAssessment) {
  if (!rawAssessment) {
    return null;
  }

  return {
    outlook: rawAssessment.outlook || 'neutral',
    rationale: rawAssessment.summary || 'No LLM rationale returned.',
    signalScore: Math.max(-1, Math.min(1, Number(rawAssessment.signalScore || 0))),
    confidenceAdjustment: Math.max(-0.2, Math.min(0.2, Number(rawAssessment.confidenceAdjustment || 0))),
    weightAdjustments: rawAssessment.weightAdjustments || {}
  };
}

async function generateSignalAssessment(context) {
  const client = getClient();

  if (!client) {
    return {
      outlook: 'neutral',
      rationale: 'OpenAI not configured; using deterministic signal assessment only.',
      signalScore: 0,
      confidenceAdjustment: 0,
      weightAdjustments: {},
      modelName: 'deterministic-fallback'
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: getModelName(),
      messages: [
        {
          role: 'user',
          content: buildPrompt(context)
        }
      ]
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('No content returned from OpenAI');
    }

    const parsed = extractJson(rawContent);
    if (!parsed) {
      throw new Error('Parsed OpenAI output is null or invalid');
    }

    const assessment = normalizeAssessment(parsed);
    return {
      ...assessment,
      modelName: getModelName(),
      rawOpenAIResponse: rawContent
    };
  } catch (error) {
    console.error(`OpenAI signal assessment failed for ${context.ticker}:`, error.message || error);
    return {
      outlook: 'neutral',
      rationale: `OpenAI fallback triggered because the model request failed: ${error.message || error}`,
      signalScore: 0,
      confidenceAdjustment: 0,
      weightAdjustments: {},
      modelName: 'deterministic-fallback',
      rawOpenAIResponse: null
    };
  }
}

module.exports = {
  generateSignalAssessment,
  getModelName,
  isOpenAIConfigured,
  extractJson,
  normalizeAssessment
};
