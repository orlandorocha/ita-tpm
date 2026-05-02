import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { User, Worker } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function resolveCurrentUserWorkerId(
  currentUser: Pick<User, "workerId" | "name"> | null | undefined,
  workers: Worker[]
) {
  if (!currentUser) {
    return undefined;
  }

  if (currentUser.workerId && workers.some((worker) => worker.id === currentUser.workerId)) {
    return currentUser.workerId;
  }

  const normalizedUserName = normalizeComparableText(currentUser.name);
  if (!normalizedUserName) {
    return undefined;
  }

  const matchedWorker = workers.find(
    (worker) => normalizeComparableText(worker.name) === normalizedUserName
  );

  return matchedWorker?.id;
}
