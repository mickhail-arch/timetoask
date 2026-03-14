'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Tool } from '@/hooks/useTools';

// ---------------------------------------------------------------------------
// JSON Schema types (subset used for form generation)
// ---------------------------------------------------------------------------

interface JSONSchemaProperty {
  type?: string | string[];
  description?: string;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  definitions?: Record<string, JSONSchema>;
  $defs?: Record<string, JSONSchema>;
}

interface ToolSchemaResponse {
  inputSchema: JSONSchema;
  outputFormat: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ToolFormProps {
  tool: Pick<Tool, 'slug' | 'name' | 'executionMode'>;
  onResult: (data: unknown, jobId?: string) => void;
}

// ---------------------------------------------------------------------------
// Field renderer
// ---------------------------------------------------------------------------

interface FieldProps {
  name: string;
  schema: JSONSchemaProperty;
  required: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: ReturnType<typeof useForm>['register'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: ReturnType<typeof useForm>['setValue'];
}

function SchemaField({ name, schema, required, register, setValue }: FieldProps) {
  const label = schema.description ?? name;
  const primaryType = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== 'null') ?? 'string'
    : schema.type ?? 'string';

  if (schema.enum && schema.enum.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <Select
          defaultValue={schema.default != null ? String(schema.default) : undefined}
          onValueChange={(val) => setValue(name, val)}
        >
          <SelectTrigger id={name}>
            <SelectValue placeholder="Выберите…" />
          </SelectTrigger>
          <SelectContent>
            {schema.enum.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Hidden input keeps the value in RHF */}
        <input type="hidden" {...register(name)} />
      </div>
    );
  }

  if (primaryType === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <input
          id={name}
          type="checkbox"
          defaultChecked={schema.default === true}
          className="size-4 rounded border-border accent-primary"
          {...register(name)}
        />
        <Label htmlFor={name} className="cursor-pointer font-normal">
          {label}
        </Label>
      </div>
    );
  }

  if (primaryType === 'number' || primaryType === 'integer') {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <Input
          id={name}
          type="number"
          defaultValue={schema.default != null ? Number(schema.default) : undefined}
          min={schema.minimum}
          max={schema.maximum}
          {...register(name, {
            valueAsNumber: true,
            required: required ? `${label} — обязательное поле` : false,
            min: schema.minimum
              ? { value: schema.minimum, message: `Минимум: ${schema.minimum}` }
              : undefined,
            max: schema.maximum
              ? { value: schema.maximum, message: `Максимум: ${schema.maximum}` }
              : undefined,
          })}
        />
      </div>
    );
  }

  // Default: text input
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      <Input
        id={name}
        type="text"
        defaultValue={schema.default != null ? String(schema.default) : undefined}
        minLength={schema.minLength}
        maxLength={schema.maxLength}
        {...register(name, {
          required: required ? `${label} — обязательное поле` : false,
          minLength: schema.minLength
            ? { value: schema.minLength, message: `Минимум ${schema.minLength} символов` }
            : undefined,
          maxLength: schema.maxLength
            ? { value: schema.maxLength, message: `Максимум ${schema.maxLength} символов` }
            : undefined,
        })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ToolForm({ tool, onResult }: ToolFormProps) {
  const [schemaData, setSchemaData] = useState<ToolSchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm();

  // Fetch JSON Schema for this tool on mount / tool change
  useEffect(() => {
    let cancelled = false;
    setSchemaLoading(true);
    setSchemaError(null);
    setSchemaData(null);

    fetch(`/api/tools/${tool.slug}/schema`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setSchemaData(json.data);
      })
      .catch((err) => {
        if (!cancelled) setSchemaError(err instanceof Error ? err.message : 'Ошибка загрузки схемы');
      })
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });

    return () => { cancelled = true; };
  }, [tool.slug]);

  // Derive the actual properties object from the JSON Schema
  // zod-to-json-schema may wrap it in definitions
  const rootSchema: JSONSchema | undefined =
    schemaData?.inputSchema?.definitions?.input ??
    schemaData?.inputSchema?.['$defs']?.input ??
    schemaData?.inputSchema;

  const properties = rootSchema?.properties ?? {};
  const requiredFields = new Set(rootSchema?.required ?? []);

  const onSubmit = async (formData: Record<string, unknown>) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/tools/${tool.slug}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: formData }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error?.message ?? 'Ошибка выполнения');
        return;
      }

      // Async tools return { jobId }, sync tools return { result }
      if (json.data?.jobId) {
        onResult(null, json.data.jobId as string);
      } else {
        onResult(json.data, undefined);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">{tool.name}</CardTitle>
      </CardHeader>

      <CardContent>
        {schemaLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded-md bg-muted" />
                <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        )}

        {schemaError && (
          <p className="text-sm text-destructive">{schemaError}</p>
        )}

        {!schemaLoading && !schemaError && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4" noValidate>
            {Object.entries(properties).map(([fieldName, fieldSchema]) => (
              <div key={fieldName}>
                <SchemaField
                  name={fieldName}
                  schema={fieldSchema}
                  required={requiredFields.has(fieldName)}
                  register={register}
                  setValue={setValue}
                />
                {errors[fieldName] && (
                  <p className="mt-1 text-xs text-destructive">
                    {String((errors[fieldName] as { message?: string })?.message ?? 'Неверное значение')}
                  </p>
                )}
              </div>
            ))}

            {submitError && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Отправка…' : 'Запустить'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
