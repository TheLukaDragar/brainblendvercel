import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { createOpenAI } from '@ai-sdk/openai';


import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';



console.log("Using OpenAI API Key:", process.env.OPENAI_API_KEY);
console.log("Using OpenAI Base URL:", process.env.OPENAI_BASE_URL);

const openaiClient = createOpenAI({
  // custom settings, e.g.
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  compatibility: 'strict', // strict mode, enable when using the OpenAI API
});
console.log(openaiClient);
const local_nemotron = openaiClient.chat('nemotron');





export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': local_nemotron,
        'chat-model-reasoning': local_nemotron,
        'title-model': local_nemotron,
        'artifact-model': local_nemotron,
      },
    })
  : customProvider({
      // languageModels: {
      //   'chat-model': xai('grok-2-1212'),
      //   'chat-model-reasoning': wrapLanguageModel({
      //     model: xai('grok-3-mini-beta'),
      //     middleware: extractReasoningMiddleware({ tagName: 'think' }),
      //   }),
      //   'title-model': xai('grok-2-1212'),
      //   'artifact-model': xai('grok-2-1212'),
      // },
      // imageModels: {
      //   'small-model': xai.image('grok-2-image'),
      // },

      languageModels: {
        'chat-model': local_nemotron,
        'chat-model-reasoning': local_nemotron,
        'title-model': local_nemotron,
        'artifact-model': local_nemotron,
      },

    });
