'use client';

import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
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

interface AutoFormProps {
  schema: JSONSchema;
  onSubmit: (data: Record<string, unknown>) => void;
  loading: boolean;
  tokenCost: number;
  freeUsesLeft: number;
  balance: number | null;
}

function resolveRootSchema(schema: JSONSchema): JSONSchema {
  return (
    schema.definitions?.input ??
    schema.$defs?.input ??
    schema
  );
}

type FieldRegister = ReturnType<typeof useForm>['register'];
type FieldSetValue = ReturnType<typeof useForm>['setValue'];

interface FieldProps {
  name: string;
  schema: JSONSchemaProperty;
  required: boolean;
  register: FieldRegister;
  setValue: FieldSetValue;
  disabled: boolean;
  error?: string;
}

function SchemaField({ name, schema, required, register, setValue, disabled, error }: FieldProps) {
  const label = schema.description ?? name;
  const primaryType = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== 'null') ?? 'string'
    : schema.type ?? 'string';

  if (schema.enum && schema.enum.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={name}>
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </Label>
        <Select
          defaultValue={schema.default != null ? String(schema.default) : undefined}
          onValueChange={(val) => setValue(name, val)}
          disabled={disabled}
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
        <input
          type="hidden"
          {...register(name, {
            required: required ? `${label} — обязательное поле` : false,
          })}
        />
        {error && <p className="mt-1 text-sm text-error">{error}</p>}
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
          className="size-4 rounded border-border accent-accent"
          disabled={disabled}
          {...register(name)}
        />
        <Label htmlFor={name} className="cursor-pointer font-normal">
          {label}
        </Label>
        {error && <p className="mt-1 text-sm text-error">{error}</p>}
      </div>
    );
  }

  if (primaryType === 'number' || primaryType === 'integer') {
    return (
      <Input
        id={name}
        type="number"
        label={`${label}${required ? ' *' : ''}`}
        defaultValue={schema.default != null ? Number(schema.default) : undefined}
        min={schema.minimum}
        max={schema.maximum}
        disabled={disabled}
        error={error}
        {...register(name, {
          valueAsNumber: true,
          required: required ? `${label} — обязательное поле` : false,
          min: schema.minimum != null
            ? { value: schema.minimum, message: `Минимум: ${schema.minimum}` }
            : undefined,
          max: schema.maximum != null
            ? { value: schema.maximum, message: `Максимум: ${schema.maximum}` }
            : undefined,
        })}
      />
    );
  }

  const useTextarea = (schema.minLength ?? 0) > 50;

  if (useTextarea) {
    return (
      <div className="w-full">
        <Label htmlFor={name} className="mb-1.5 block text-sm font-medium text-text-secondary">
          {label}{required && <span className="ml-0.5 text-error">*</span>}
        </Label>
        <textarea
          id={name}
          className="w-full rounded-lg border border-border bg-bg-surface px-4 py-3 text-base text-text-primary outline-none transition-colors resize-y focus:border-border-focus focus:[border-width:1.5px] disabled:cursor-not-allowed disabled:bg-bg-sidebar"
          rows={4}
          disabled={disabled}
          defaultValue={schema.default != null ? String(schema.default) : undefined}
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
        {error && <p className="mt-1 text-sm text-error">{error}</p>}
      </div>
    );
  }

  return (
    <Input
      id={name}
      type="text"
      label={`${label}${required ? ' *' : ''}`}
      defaultValue={schema.default != null ? String(schema.default) : undefined}
      disabled={disabled}
      error={error}
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
  );
}

function RunButton({
  loading,
  tokenCost,
  freeUsesLeft,
  balance,
}: {
  loading: boolean;
  tokenCost: number;
  freeUsesLeft: number;
  balance: number | null;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <Button type="submit" variant="accent" fullWidth loading disabled>
        Выполняется…
      </Button>
    );
  }

  if (freeUsesLeft > 0) {
    return (
      <Button type="submit" variant="accent" fullWidth>
        Запустить бесплатно (осталось {freeUsesLeft})
      </Button>
    );
  }

  if (balance !== null && balance < tokenCost) {
    return (
      <Button
        type="button"
        variant="accent"
        fullWidth
        onClick={() => router.push('/billing')}
      >
        Пополнить баланс
      </Button>
    );
  }

  return (
    <Button type="submit" variant="accent" fullWidth>
      Запустить · {tokenCost} тк
    </Button>
  );
}

export function AutoForm({
  schema,
  onSubmit,
  loading,
  tokenCost,
  freeUsesLeft,
  balance,
}: AutoFormProps) {
  const root = resolveRootSchema(schema);
  const properties = root.properties ?? {};
  const requiredFields = new Set(root.required ?? []);

  const defaultValues: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(properties)) {
    if (prop.default != null) {
      defaultValues[key] = prop.default;
    }
  }

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({ defaultValues });

  const isDisabled = loading || (balance !== null && balance < tokenCost && freeUsesLeft <= 0);

  const onFormSubmit = (data: Record<string, unknown>) => {
    if (balance !== null && balance < tokenCost && freeUsesLeft <= 0) return;
    onSubmit(data);
  };

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <form onSubmit={handleSubmit(onFormSubmit as any)} className="space-y-4" noValidate>
      {Object.entries(properties).map(([fieldName, fieldSchema]) => (
        <SchemaField
          key={fieldName}
          name={fieldName}
          schema={fieldSchema}
          required={requiredFields.has(fieldName)}
          register={register}
          setValue={setValue}
          disabled={isDisabled}
          error={
            errors[fieldName]
              ? String((errors[fieldName] as { message?: string })?.message ?? 'Неверное значение')
              : undefined
          }
        />
      ))}

      <RunButton
        loading={loading}
        tokenCost={tokenCost}
        freeUsesLeft={freeUsesLeft}
        balance={balance}
      />
    </form>
  );
}
