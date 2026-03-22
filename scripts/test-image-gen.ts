import { generateText, generateImage } from '../adapters/llm/openrouter.adapter';

async function main() {
  console.log('=== Step 1: Generate image prompt via LLM ===\n');

  let imagePrompt: string;

  try {
    imagePrompt = await generateText({
      model: 'google/gemini-2.5-flash',
      systemPrompt:
        'Generate a detailed image generation prompt in English. Output ONLY the prompt text. Max 200 words.',
      userMessage: [
        'Scene description: Мобильное приложение Poizon на экране смартфона',
        'Style: photorealistic',
        'Topic: Poizon',
      ].join('\n'),
    });

    console.log('Generated prompt:\n');
    console.log(imagePrompt);
    console.log();
  } catch (err) {
    console.error('Failed to generate text prompt:\n');
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  }

  console.log('=== Step 2: Generate image ===\n');

  try {
    const result = await generateImage({
      model: 'google/gemini-3.1-flash-image-preview',
      prompt: imagePrompt,
      size: '1792x1024',
    });

    console.log('Image generation result:');
    console.log('  url:', result.url ?? '(none)');
    console.log('  b64_json:', result.b64_json ? `present (${result.b64_json.length} chars)` : '(none)');
  } catch (err) {
    console.error('Failed to generate image:\n');
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  }

  console.log('\n=== Done ===');
}

main();
