export type ToolRecord = {
  id: string;
  model: string;
  promptText: string;
  tokenCost: number;
  slug: string;
  name: string;
};

export interface PipelineContext {
  parentJobId: string;
  userId: string;
  tool: ToolRecord;
  input: Record<string, unknown>;
  data: Record<string, unknown>;
  model: string;
}

export type StepExecutor = (ctx: PipelineContext) => Promise<unknown>;

export interface PipelineStepDef {
  name: string;
  modelOverride?: string;
  execute: StepExecutor;
}
