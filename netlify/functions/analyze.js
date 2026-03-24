const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an AI automation cost analyst at Trivox AI. Analyze this employee data and return ONLY a valid JSON object. Do NOT wrap in markdown code fences. Do NOT include any text outside the JSON object.

Return this exact structure:
{
  "totalAnnualSalaryCost": number,
  "automationOpportunityCost": number (how much of total salary goes to automatable tasks — be realistic, typically 20-50% of roles with repetitive tasks),
  "automationPercentage": number (0-100),
  "annualSavings": number (realistic savings after AI implementation — typically 60-80% of automation opportunity cost),
  "implementationCost": number (estimated one-time cost to build automations — typically $5K-$50K depending on complexity),
  "roiMonths": number (months to ROI — implementationCost / (annualSavings/12)),
  "employees": [
    {
      "role": "string",
      "salary": number,
      "automatableTasks": ["string — only tasks from their checklist that can be automated"],
      "automationPercentage": number (0-100 — what % of their work is automatable),
      "potentialSavings": number (salary * automationPercentage/100 * 0.7),
      "recommendation": "string (1 specific sentence about what to automate for this role)"
    }
  ],
  "topAutomations": [
    {
      "name": "string (specific automation system name)",
      "affectedRoles": ["string"],
      "annualSavings": number,
      "implementationDifficulty": "Easy|Medium|Complex",
      "timeToImplement": "string (e.g. 1-2 weeks)"
    }
  ],
  "executiveSummary": "string (3 sentences — reference their specific industry, team size, and biggest automation opportunities. Be specific, not generic.)"
}

Rules:
- Be realistic and conservative with savings estimates — this is used in live sales meetings
- automationPercentage per employee should reflect how much of THEIR specific tasks are automatable
- Roles like receptionist, data entry, and admin have higher automation percentages (40-70%)
- Roles like senior management, creative, and strategy have lower (5-20%)
- topAutomations should have 3-5 items, ranked by annual savings
- All recommendations must reference the specific role and tasks provided
- implementationCost should be realistic for a small automation agency ($5K-$50K range)`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    if (!body.employees || !Array.isArray(body.employees) || body.employees.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'At least one employee is required' }),
      };
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(body),
        },
      ],
    });

    let text = response.content?.[0]?.text || '';
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Analyze function error:', error.message);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Failed to generate analysis' }),
    };
  }
};
