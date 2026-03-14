import type { PipelineStepDef } from '../pipeline.types';
import { seoArticleSteps } from './seo-article.pipeline';

export const pipelineRegistry: Record<string, PipelineStepDef[]> = {
  'seo-article': seoArticleSteps,
};
