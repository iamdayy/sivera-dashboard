<template>
    <Toaster position="top-right" :toastOptions="{
        duration: 4000,
        dismissible: true,
        closeButton: true,
        style: {
            background: 'var(--toast-bg)',
            color: 'var(--toast-color)',
            border: '1px solid var(--toast-border)',
        },
        success: {
            iconTheme: { primary: '#16a34a', secondary: '#fff' },
        },
        error: {
            iconTheme: { primary: '#dc2626', secondary: '#fff' },
        },
        info: {
            iconTheme: { primary: '#2563eb', secondary: '#fff' },
        },
        warning: {
            iconTheme: { primary: '#d97706', secondary: '#fff' },
        },
    }" />
</template>

<script setup>
import { Toaster } from 'vue-sonner';
import 'vue-sonner/style.css';
</script>

<style scoped>
:root {
    --toast-bg: #ffffff;
    --toast-color: #1f2937;
    --toast-border: #e5e7eb;
}

.dark {
    --toast-bg: #1f2937;
    --toast-color: #f9fafb;
    --toast-border: #374151;
}
</style>