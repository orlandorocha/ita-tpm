import { NextResponse, type NextRequest } from "next/server";
import {
  mapUserRow,
  mapWorkScheduleCycleOverrideRow,
  mapWorkScheduleDayOverrideRow,
  mapWorkScheduleRow,
  mapWorkerRow,
} from "@/lib/supabase-mappers";
import {
  buildTeamsOverdueServiceOrdersMessage,
  buildTeamsAvailableMaintainersMessage,
  buildTeamsDayOffMessage,
  getBusinessDateFromKey,
  getBusinessDateKey,
  getMaintainersAvailableForActivities,
  getMaintainersOnDayOff,
} from "@/lib/day-off-alerts";
import type {
  EquipmentRow,
  ServiceOrderRow,
  ServiceOrderWorkerRow,
  UserRow,
  WorkScheduleCycleOverrideRow,
  WorkScheduleDayOverrideRow,
  WorkScheduleRow,
  WorkerRow,
} from "@/lib/types";
import type { OverdueServiceOrderAlert } from "@/lib/day-off-alerts";

export const dynamic = "force-dynamic";

const DAY_OVERRIDE_SELECT = "*";
const DAY_OVERRIDE_SELECT_FALLBACK = "id, schedule_id, schedule_date, day_status, created_at, updated_at";
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const TEAMS_MAX_ATTEMPTS = 3;
const TEAMS_RETRY_DELAY_MS = 1_500;

function allowInsecureTls() {
  return process.env.ALERTS_ALLOW_INSECURE_TLS === "true";
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e uma chave do Supabase para enviar alertas automáticos."
    );
  }

  return { supabaseUrl, supabaseKey };
}

function requestText(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  }
) {
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const timeoutHandle = setTimeout(() => {
    controller.abort(new Error(`Tempo limite excedido ao acessar ${url}.`));
  }, timeoutMs);

  if (allowInsecureTls()) {
    console.warn("[teams-day-off-alert] ALERTS_ALLOW_INSECURE_TLS foi ignorado no runtime atual.");
  }

  return fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
    signal: controller.signal,
  })
    .then(async (response) => ({
      status: response.status,
      text: await response.text(),
    }))
    .finally(() => {
      clearTimeout(timeoutHandle);
    });
}

function sleep(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function requestSupabase<TableRow>(path: string) {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  const response = await requestText(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.text || `Falha ao consultar Supabase em ${path}.`);
  }

  return JSON.parse(response.text || "[]") as TableRow[];
}

async function mutateSupabase(path: string, options: { method: "PATCH" | "POST" | "DELETE"; body?: unknown }) {
  const { supabaseUrl, supabaseKey } = getSupabaseConfig();
  const response = await requestText(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.text || `Falha ao executar ${options.method} em ${path}.`);
  }
}

async function syncOverdueServiceOrders(dateKey: string) {
  await mutateSupabase(
    `service_orders?due_date=lt.${dateKey}&status=not.in.(Finalizada,Atrasada)`,
    {
      method: "PATCH",
      body: { status: "Atrasada" },
    }
  );
}

function buildOverdueServiceOrders(params: {
  orders: ServiceOrderRow[];
  assignments: ServiceOrderWorkerRow[];
  equipments: EquipmentRow[];
  workers: WorkerRow[];
}) {
  const { orders, assignments, equipments, workers } = params;
  const equipmentById = new Map(equipments.map((equipment) => [equipment.id, equipment]));
  const workerById = new Map(workers.map((worker) => [worker.id, worker]));

  return orders
    .filter((order) => order.due_date && order.status !== "Finalizada")
    .map<OverdueServiceOrderAlert>((order) => {
      const equipment = equipmentById.get(order.equipment_id);
      const workerNames = assignments
        .filter((assignment) => assignment.service_order_id === order.id)
        .map((assignment) => workerById.get(assignment.worker_id)?.name)
        .filter((name): name is string => Boolean(name))
        .sort((left, right) => left.localeCompare(right, "pt-BR"));

      return {
        id: order.id,
        number: order.number,
        dueDate: order.due_date as string,
        status: order.status,
        equipmentName: equipment?.name ?? "Equipamento não encontrado",
        equipmentCode: equipment?.code ?? "—",
        workerNames,
      };
    })
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

async function postTeamsMessage(webhookUrl: string, message: string) {
  const response = await requestText(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: message,
    }),
    timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  });

  return response;
}

function isRetryableTeamsStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function postTeamsMessageWithRetry(webhookUrl: string, message: string) {
  let lastResponse: { status: number; text: string } | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= TEAMS_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await postTeamsMessage(webhookUrl, message);
      lastResponse = response;

      if (!isRetryableTeamsStatus(response.status) || attempt === TEAMS_MAX_ATTEMPTS) {
        return response;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === TEAMS_MAX_ATTEMPTS) {
        throw lastError;
      }
    }

    await sleep(TEAMS_RETRY_DELAY_MS);
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error("Falha ao enviar mensagem ao Teams.");
}

function isMissingOvertimeColumnError(error: { message?: string | null } | null | undefined) {
  return Boolean(error?.message?.includes("is_overtime"));
}

function isAuthorizedRequest(request: NextRequest) {
  if (request.headers.get("x-vercel-cron") === "1") {
    return true;
  }

  const platformCronSecret = process.env.CRON_SECRET;
  const manualTriggerSecret = process.env.DAY_OFF_ALERT_CRON_SECRET;
  const authorizationHeader = request.headers.get("authorization");

  if (platformCronSecret && authorizationHeader === `Bearer ${platformCronSecret}`) {
    return true;
  }

  if (!platformCronSecret && request.headers.get("user-agent") === "vercel-cron/1.0") {
    return true;
  }

  if (manualTriggerSecret && authorizationHeader === `Bearer ${manualTriggerSecret}`) {
    return true;
  }

  const providedSecret =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");

  if (manualTriggerSecret) {
    return providedSecret === manualTriggerSecret;
  }

  return !platformCronSecret;
}

function isPreviewRequest(request: NextRequest) {
  const previewParam = new URL(request.url).searchParams.get("preview");
  return previewParam === "1" || previewParam === "true";
}

function getRequestSource(request: NextRequest) {
  if (request.headers.get("x-vercel-cron") === "1") {
    return "vercel-cron-header";
  }

  if (request.headers.get("user-agent") === "vercel-cron/1.0") {
    return "vercel-cron-user-agent";
  }

  if (request.headers.get("x-cron-secret")) {
    return "manual-header-secret";
  }

  if (new URL(request.url).searchParams.get("secret")) {
    return "manual-query-secret";
  }

  if (request.headers.get("authorization")) {
    return "authorization-header";
  }

  return "unknown";
}

export async function GET(request: NextRequest) {
  const requestSource = getRequestSource(request);

  if (!isAuthorizedRequest(request)) {
    console.warn("[teams-day-off-alert] Unauthorized request rejected.", {
      source: requestSource,
      hasCronSecret: Boolean(process.env.CRON_SECRET),
      hasManualSecret: Boolean(process.env.DAY_OFF_ALERT_CRON_SECRET),
    });

    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const previewOnly = isPreviewRequest(request);
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

  console.info("[teams-day-off-alert] Request accepted.", {
    source: requestSource,
    previewOnly,
    hasWebhookUrl: Boolean(webhookUrl),
  });

  if (!previewOnly && !webhookUrl) {
    console.error("[teams-day-off-alert] Missing TEAMS_WEBHOOK_URL for non-preview request.");

    return NextResponse.json(
      { error: "Defina TEAMS_WEBHOOK_URL para enviar alertas ao Teams." },
      { status: 500 }
    );
  }

  const resolvedWebhookUrl = webhookUrl ?? null;

  try {
    const dateKey = getBusinessDateKey();
    const targetDate = getBusinessDateFromKey(dateKey);

    await syncOverdueServiceOrders(dateKey);

    const [workers, users, schedules, cycleOverrides, overdueOrdersRows, orderAssignments, equipments] =
      await Promise.all([
        requestSupabase<WorkerRow>("workers?select=*"),
        requestSupabase<UserRow>("users?select=*&active=eq.true&role=eq.Manutentor"),
        requestSupabase<WorkScheduleRow>("worker_schedules?select=*"),
        requestSupabase<WorkScheduleCycleOverrideRow>("worker_schedule_cycle_overrides?select=*"),
        requestSupabase<ServiceOrderRow>(
          `service_orders?select=id,number,status,due_date,equipment_id&due_date=lt.${dateKey}&status=neq.Finalizada&order=due_date.asc`
        ),
        requestSupabase<ServiceOrderWorkerRow>("service_order_workers?select=service_order_id,worker_id,created_at"),
        requestSupabase<EquipmentRow>("equipments?select=id,name,code,location,production_line,created_at"),
      ]);

    let overrideRows: WorkScheduleDayOverrideRow[];

    try {
      overrideRows = await requestSupabase<WorkScheduleDayOverrideRow>(
        `worker_schedule_day_overrides?select=${encodeURIComponent(DAY_OVERRIDE_SELECT)}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!isMissingOvertimeColumnError({ message })) {
        throw error;
      }

      overrideRows = await requestSupabase<WorkScheduleDayOverrideRow>(
        `worker_schedule_day_overrides?select=${encodeURIComponent(DAY_OVERRIDE_SELECT_FALLBACK)}`
      );
    }

    const mappedWorkers = workers.map(mapWorkerRow);
    const mappedUsers = users.map(mapUserRow);
    const mappedSchedules = schedules.map(mapWorkScheduleRow);
    const overrides = overrideRows.map(mapWorkScheduleDayOverrideRow);
    const mappedCycleOverrides = cycleOverrides.map(mapWorkScheduleCycleOverrideRow);

    const dayOffWorkers = getMaintainersOnDayOff({
      workers: mappedWorkers,
      users: mappedUsers,
      schedules: mappedSchedules,
      overrides,
      cycleOverrides: mappedCycleOverrides,
      date: targetDate,
    });

    const availableWorkers = getMaintainersAvailableForActivities({
      workers: mappedWorkers,
      users: mappedUsers,
      schedules: mappedSchedules,
      overrides,
      cycleOverrides: mappedCycleOverrides,
      date: targetDate,
    });

    const dayOffMessage = buildTeamsDayOffMessage(dayOffWorkers, dateKey);
    const availableMessage = buildTeamsAvailableMaintainersMessage(availableWorkers, dateKey);
    const overdueOrders = buildOverdueServiceOrders({
      orders: overdueOrdersRows,
      assignments: orderAssignments,
      equipments,
      workers,
    });
    const overdueOrdersMessage = buildTeamsOverdueServiceOrdersMessage(overdueOrders, dateKey);

    console.info("[teams-day-off-alert] Alert payload prepared.", {
      date: dateKey,
      source: requestSource,
      recipients: {
        dayOff: dayOffWorkers.length,
        available: availableWorkers.length,
        overdueOrders: overdueOrders.length,
      },
    });

    if (previewOnly) {
      return NextResponse.json({
        sent: false,
        preview: true,
        externalDispatchAttempted: false,
        date: dateKey,
        recipients: {
          dayOff: dayOffWorkers.length,
          available: availableWorkers.length,
          overdueOrders: overdueOrders.length,
        },
        workers: dayOffWorkers,
        availableWorkers,
        overdueOrders,
        payload: {
          messages: [
            {
              kind: "dayOff",
              text: dayOffMessage,
            },
            {
              kind: "available",
              text: availableMessage,
            },
            {
              kind: "overdueOrders",
              text: overdueOrdersMessage,
            },
          ],
        },
      });
    }

    if (!resolvedWebhookUrl) {
      return NextResponse.json(
        { error: "Defina TEAMS_WEBHOOK_URL para enviar alertas ao Teams." },
        { status: 500 }
      );
    }

    const dayOffTeamsResponse = await postTeamsMessageWithRetry(resolvedWebhookUrl, dayOffMessage);

    if (dayOffTeamsResponse.status < 200 || dayOffTeamsResponse.status >= 300) {
      console.error("[teams-day-off-alert] Teams rejected day-off message.", {
        status: dayOffTeamsResponse.status,
        details: dayOffTeamsResponse.text,
      });

      return NextResponse.json(
        {
          error: "O Teams recusou o alerta automático.",
          details: dayOffTeamsResponse.text,
          messageKind: "dayOff",
        },
        { status: 502 }
      );
    }

    const availableTeamsResponse = await postTeamsMessageWithRetry(
      resolvedWebhookUrl,
      availableMessage
    );

    if (availableTeamsResponse.status < 200 || availableTeamsResponse.status >= 300) {
      console.error("[teams-day-off-alert] Teams rejected available-maintainers message.", {
        status: availableTeamsResponse.status,
        details: availableTeamsResponse.text,
      });

      return NextResponse.json(
        {
          error: "O Teams recusou o alerta automático.",
          details: availableTeamsResponse.text,
          messageKind: "available",
        },
        { status: 502 }
      );
    }

    const overdueOrdersTeamsResponse = await postTeamsMessageWithRetry(
      resolvedWebhookUrl,
      overdueOrdersMessage
    );

    if (overdueOrdersTeamsResponse.status < 200 || overdueOrdersTeamsResponse.status >= 300) {
      console.error("[teams-day-off-alert] Teams rejected overdue-orders message.", {
        status: overdueOrdersTeamsResponse.status,
        details: overdueOrdersTeamsResponse.text,
      });

      return NextResponse.json(
        {
          error: "O Teams recusou o alerta automático.",
          details: overdueOrdersTeamsResponse.text,
          messageKind: "overdueOrders",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      sent: true,
      date: dateKey,
      recipients: {
        dayOff: dayOffWorkers.length,
        available: availableWorkers.length,
        overdueOrders: overdueOrders.length,
      },
      dispatchedMessages: ["dayOff", "available", "overdueOrders"],
      workers: dayOffWorkers,
      availableWorkers,
      overdueOrders,
    });
  } catch (error) {
    console.error("[teams-day-off-alert] Unexpected failure.", {
      source: requestSource,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha inesperada ao enviar o alerta automático.",
      },
      { status: 500 }
    );
  }
}
