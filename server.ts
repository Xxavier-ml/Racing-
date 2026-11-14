import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add a valid Gemini API key in AI Studio Settings > Secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(raw)) {
    return {
      status: 403,
      message:
        'Gemini API key permission denied or invalid. Please check your GEMINI_API_KEY in AI Studio Settings > Secrets.',
    };
  }
  if (/RESOURCE_EXHAUSTED|429|quota|billing|paid/i.test(raw)) {
    return {
      status: 429,
      message:
        'Quota reached or paid tier required for this model. Select a billing-enabled key in AI Studio Settings > Secrets.',
    };
  }
  if (/not configured/i.test(raw)) {
    return { status: 400, message: raw };
  }
  return { status: 500, message: raw || 'Unexpected Gemini API error.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'nairobi-express-server' });
  });

  // Nairobi City Guide with Gemini 3.8 Flash + Google Maps / Google Search Grounding
  app.post('/api/nairobi/explore', async (req: Request, res: Response) => {
    try {
      const { query, mode, lat, lng } = req.body as {
        query?: string;
        mode?: 'maps' | 'search';
        lat?: number;
        lng?: number;
      };

      if (!query || !query.trim()) {
        res.status(400).json({ error: 'Please enter a Nairobi street, landmark, or navigation question.' });
        return;
      }

      const ai = getAiClient();
      const useMaps = mode !== 'search';

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: useMaps
          ? `You are a Nairobi, Kenya urban navigation and city guide. Answer concisely with accurate street names, roundabouts, landmarks, and practical local driving/matatu wayfinding advice in Nairobi for: ${query.trim()}`
          : `You are a Nairobi, Kenya local city & traffic correspondent. Provide accurate, up-to-date information about Nairobi streets, landmarks, urban infrastructure, or traffic context for: ${query.trim()}`,
        config: useMaps
          ? {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: typeof lat === 'number' ? lat : -1.286389,
                    longitude: typeof lng === 'number' ? lng : 36.817223,
                  },
                },
              },
            }
          : {
              tools: [{ googleSearch: {} }],
            },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const mapLinks: Array<{ title: string; uri: string; snippet?: string }> = [];
      const webLinks: Array<{ title: string; uri: string }> = [];

      for (const chunk of chunks as Array<{
        maps?: {
          title?: string;
          uri?: string;
          placeAnswerSources?: { reviewSnippets?: Array<{ content?: string }> };
        };
        web?: { title?: string; uri?: string };
      }>) {
        if (chunk.maps?.uri) {
          mapLinks.push({
            title: chunk.maps.title || 'View on Google Maps',
            uri: chunk.maps.uri,
            snippet: chunk.maps.placeAnswerSources?.reviewSnippets?.[0]?.content,
          });
        }
        if (chunk.web?.uri) {
          webLinks.push({
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        }
      }

      res.json({
        text: response.text ?? 'No response returned.',
        mode: useMaps ? 'maps' : 'search',
        mapLinks,
        webLinks,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Image Generation & Editing (gemini-nano-banana-2.1 and gemini-3-pro-image-preview)
  app.post('/api/nairobi/image', async (req: Request, res: Response) => {
    try {
      const { prompt, model, imageSize, aspectRatio, sourceImageBase64, sourceMimeType } = req.body as {
        prompt?: string;
        model?: 'gemini-nano-banana-2.1' | 'gemini-3-pro-image-preview';
        imageSize?: '1K' | '2K' | '4K';
        aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
        sourceImageBase64?: string;
        sourceMimeType?: string;
      };

      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Please enter a prompt to generate or edit an image.' });
        return;
      }

      const ai = getAiClient();
      const selectedModel =
        model === 'gemini-3-pro-image-preview' ? 'gemini-3-pro-image-preview' : 'gemini-nano-banana-2.1';
      const selectedSize = imageSize === '2K' || imageSize === '4K' ? imageSize : '1K';
      const selectedAspect = aspectRatio || '16:9';

      const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
      if (sourceImageBase64 && sourceMimeType) {
        parts.push({
          inlineData: {
            data: sourceImageBase64,
            mimeType: sourceMimeType,
          },
        });
      }
      parts.push({ text: prompt.trim() });

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: selectedAspect,
            imageSize: selectedSize,
          },
        },
      });

      let imageUrl: string | null = null;
      let caption = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          caption += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({ error: caption || 'Model did not return an image. Try refining your prompt.' });
        return;
      }

      res.json({ imageUrl, caption, model: selectedModel, imageSize: selectedSize });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Animate Image into Video (gemini-omni-1.2-flash via Interactions API)
  app.post('/api/nairobi/video', async (req: Request, res: Response) => {
    try {
      const { prompt, imageBase64, mimeType, aspectRatio } = req.body as {
        prompt?: string;
        imageBase64?: string;
        mimeType?: string;
        aspectRatio?: '16:9' | '9:16';
      };

      if (!imageBase64 || !mimeType) {
        res.status(400).json({ error: 'Please upload a photo to animate into a video.' });
        return;
      }

      const ai = getAiClient();
      const chosenAspect = aspectRatio === '9:16' ? '9:16' : '16:9';
      const motionPrompt =
        prompt && prompt.trim()
          ? prompt.trim()
          : 'Smooth cinematic camera glide along this Nairobi street with moving traffic and sunlit atmosphere.';

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type: mimeType,
              data: imageBase64,
            },
            {
              type: 'text',
              text: motionPrompt,
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: chosenAspect,
          },
        },
        { timeout: 300000 },
      );

      const videoPart = interaction.output_video;
      if (!videoPart || !videoPart.data) {
        res.status(502).json({ error: 'Video generation completed without video data.' });
        return;
      }

      const outMime = videoPart.mime_type || 'video/mp4';
      const videoDataUrl = `data:${outMime};base64,${videoPart.data}`;
      res.json({ videoDataUrl, mimeType: outMime, aspectRatio: chosenAspect });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nairobi Express server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
