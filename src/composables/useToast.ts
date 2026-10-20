import { toast } from 'vue-sonner'

export interface ToastOptions {
    description?: string
    action?: {
        label: string
        onClick: () => void
    }
    duration?: number
}

export function useToast() {
    const success = (message: string, options?: ToastOptions) => {
        return toast.success(message, {
            description: options?.description,
            action: options?.action,
            duration: options?.duration ?? 4000,
        })
    }

    const error = (message: string, options?: ToastOptions) => {
        return toast.error(message, {
            description: options?.description,
            action: options?.action,
            duration: options?.duration ?? 6000,
        })
    }

    const info = (message: string, options?: ToastOptions) => {
        return toast.info(message, {
            description: options?.description,
            action: options?.action,
            duration: options?.duration ?? 4000,
        })
    }

    const warning = (message: string, options?: ToastOptions) => {
        return toast.warning(message, {
            description: options?.description,
            action: options?.action,
            duration: options?.duration ?? 5000,
        })
    }

    const promise = <T>(
        promise: Promise<T>,
        messages: {
            loading: string
            success: string | ((data: T) => string)
            error: string | ((error: Error) => string)
        }
    ) => {
        return toast.promise(promise, messages)
    }

    const dismiss = (toastId?: string | number) => {
        toast.dismiss(toastId)
    }

    return {
        success,
        error,
        info,
        warning,
        promise,
        dismiss,
    }
}

// Global toast instance for non-component usage (e.g., in composables)
export const globalToast = {
    success: (message: string, options?: ToastOptions) => toast.success(message, options),
    error: (message: string, options?: ToastOptions) => toast.error(message, options),
    info: (message: string, options?: ToastOptions) => toast.info(message, options),
    warning: (message: string, options?: ToastOptions) => toast.warning(message, options),
    promise: <T>(
        promise: Promise<T>,
        messages: {
            loading: string
            success: string | ((data: T) => string)
            error: string | ((error: Error) => string)
        }
    ) => toast.promise(promise, messages),
    dismiss: (toastId?: string | number) => toast.dismiss(toastId),
}