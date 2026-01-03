"use client";

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  ToastWithIcon,
} from "./toast";
import { useToast } from "./use-toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <ToastWithIcon
            key={id}
            variant={variant}
            title={title}
            description={description}
            {...props}
          >
            {action}
            <ToastClose />
          </ToastWithIcon>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}






