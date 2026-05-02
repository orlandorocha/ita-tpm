type SupabaseMutationError = {
  code?: string | null;
  message: string;
  details?: string | null;
};

type FieldMessageFactory = (value?: string) => string;

function extractFieldAndValue(error: SupabaseMutationError) {
  const detailsMatch = error.details?.match(/Key \(([^)]+)\)=\(([^)]*)\)/i);
  if (detailsMatch) {
    return {
      field: detailsMatch[1],
      value: detailsMatch[2],
    };
  }

  const messageMatch = error.message.match(/\(([^)]+)\)=\(([^)]*)\)/i);
  if (messageMatch) {
    return {
      field: messageMatch[1],
      value: messageMatch[2],
    };
  }

  return {
    field: undefined,
    value: undefined,
  };
}

export function getFriendlyMutationError(
  error: SupabaseMutationError,
  options: {
    uniqueFields?: Record<string, FieldMessageFactory>;
    foreignKeyMessage?: string;
    checkConstraintMessage?: string;
    defaultMessage?: string;
  } = {}
) {
  if (error.code === "23505") {
    const { field, value } = extractFieldAndValue(error);
    const fieldMessage = field ? options.uniqueFields?.[field] : undefined;
    if (fieldMessage) {
      return fieldMessage(value);
    }

    return options.defaultMessage ?? "Já existe um registro com esses dados.";
  }

  if (error.code === "23503" && options.foreignKeyMessage) {
    return options.foreignKeyMessage;
  }

  if (error.code === "23514" && options.checkConstraintMessage) {
    return options.checkConstraintMessage;
  }

  return error.message || options.defaultMessage || "Não foi possível concluir a operação.";
}