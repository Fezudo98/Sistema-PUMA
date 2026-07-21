import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const apiKey = process.env.ANTHROPIC_API_KEY || "";

const anthropic = new Anthropic({
  apiKey: apiKey,
});

async function testClaudeGeneration() {
  console.log("=========================================================");
  console.log("🚀 TESTANDO GERAÇÃO DE QUESTÕES COM CLAUDE SONNET 5 E PDF 🚀");
  console.log("=========================================================\n");

  const pdfPath = path.join(process.cwd(), "public", "uploads", "1783782772301-64775003-ApostilasCFSdPM2026-T01-FundamentosDireitoPenal.pdf");
  
  let base64Data = "";
  try {
    const buffer = await fs.readFile(pdfPath);
    base64Data = buffer.toString("base64");
    console.log(`📄 PDF carregado com sucesso (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err: any) {
    console.error("❌ Erro ao ler PDF:", err.message);
    return;
  }

  const prompt = `Você é um Oficial da Polícia Militar e examinador rigoroso de concurso público.
Com base no documento PDF fornecido, elabore EXATAMENTE 2 questões de múltipla escolha inéditas e de alto nível para o Curso de Formação de Soldados (CFSd PMCE).

Cada questão DEVE ter obrigatoriamente 5 alternativas (de A a E).
A resposta DEVE ser ÚNICA E EXCLUSIVAMENTE um array JSON válido, sem markdown (\`\`\`json), sem textos extras antes ou depois, seguindo este formato:
[
  {
    "enunciado": "Texto da questão...",
    "alternativas": ["A) alternativa 1", "B) alternativa 2", "C) alternativa 3", "D) alternativa 4", "E) alternativa 5"],
    "correta": 0,
    "explicacao": "Explicação técnica detalhada baseada no PDF."
  }
]`;

  const models = ["claude-sonnet-5", "claude-fable-5", "claude-opus-4-8"];

  for (const model of models) {
    console.log(`\n🤖 Testando geração com modelo [${model}]...`);
    const startTime = Date.now();
    try {
      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Data
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      });

      const duration = Date.now() - startTime;
      const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
      
      console.log(`⏱️ Tempo de resposta: ${(duration / 1000).toFixed(2)}s`);
      
      // Tenta limpar e validar JSON
      let jsonText = rawText.trim();
      if (jsonText.startsWith("```json")) {
        jsonText = jsonText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(jsonText);
      console.log(`✅ [SUCESSO - ${model}] JSON parsed com sucesso! ${parsed.length} questões geradas.`);
      console.log(`📌 Exemplo Questão 1: "${parsed[0]?.enunciado?.slice(0, 80)}..."`);
      console.log(`📌 Alternativa correta (${parsed[0]?.correta}): ${parsed[0]?.alternativas[parsed[0]?.correta]}`);
      break; // Se o primeiro (Sonnet 5) funcionou com sucesso, não precisa rodar os outros no teste
    } catch (err: any) {
      console.error(`❌ [ERRO - ${model}]:`, err.message || err);
    }
  }

  console.log("\n=========================================================");
  console.log("🏁 Teste concluído!");
  console.log("=========================================================\n");
}

testClaudeGeneration();
