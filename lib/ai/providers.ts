import {
  customProvider,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';


import { isTestEnvironment } from '../constants';



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


const openai_api = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
  compatibility: 'strict', // strict mode, enable when using the OpenAI API
});


export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': local_nemotron,
        'chat-model-reasoning': local_nemotron,
        'title-model': local_nemotron,
        'artifact-model': local_nemotron,
        'tag-model': local_nemotron,
        'expert-consensus-synthesis-model': local_nemotron,
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
        'chat-model': xai('grok-2-1212'),
        'chat-model-reasoning': xai('grok-3-mini-beta'),
        'title-model': google('gemini-2.0-flash'),
        'artifact-model': google('gemini-2.0-flash'),
        'tag-model': google('gemini-2.0-flash'),
        'expert-consensus-synthesis-model': google('gemini-2.0-flash'),
      },
      textEmbeddingModels: {
        'text-embedding-3-small': openai_api.embedding('text-embedding-3-small'),
      },
    });
