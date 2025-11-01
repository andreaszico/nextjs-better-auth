import { toast, type ExternalToast } from "sonner";
import type { ReactNode } from "react";

type TitleT = string;

export function useToast() {
  const toastFn = toast as ((message: TitleT, data?: ExternalToast) => string | number) & {
    success: (message: TitleT | ReactNode, data?: ExternalToast) => string | number;
    info: (message: TitleT | ReactNode, data?: ExternalToast) => string | number;
    warning: (message: TitleT | ReactNode, data?: ExternalToast) => string | number;
    error: (message: TitleT | ReactNode, data?: ExternalToast) => string | number;
    promise: <T>(
      promise: Promise<T>,
      options: {
        loading: TitleT | ReactNode;
        success: TitleT | ((result: T) => TitleT | ReactNode);
        error: TitleT | ((error: any) => TitleT | ReactNode);
      } & ExternalToast
    ) => T extends Promise<infer U> ? U : never;
    dismiss: (id?: string | number) => void;
    loading: (message: TitleT | ReactNode, data?: ExternalToast) => string | number;
  };

  return {
    toast: toastFn,
  };
}