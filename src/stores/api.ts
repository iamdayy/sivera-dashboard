import { defineStore } from 'pinia'
import { ref } from 'vue'
import apiClient from '../services/api'

export const useApiStore = defineStore('api', () => {
    const isAuthenticated = ref(false)
    const apiKey = ref('')
    const apiBaseUrl = ref(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1')

    const setApiKey = (key: string) => {
        apiKey.value = key
        isAuthenticated.value = !!key
        localStorage.setItem('api_key', key)
    }

    const clearApiKey = () => {
        apiKey.value = ''
        isAuthenticated.value = false
        localStorage.removeItem('api_key')
    }

    const testConnection = async () => {
        try {
            const response = await apiClient.get('/health')
            isAuthenticated.value = true
            return response.data
        } catch (error) {
            isAuthenticated.value = false
            throw error
        }
    }

    // Initialize from localStorage on load
    const init = () => {
        const savedKey = localStorage.getItem('api_key')
        if (savedKey) {
            apiKey.value = savedKey
            isAuthenticated.value = true
        }
    }

    init()

    return {
        isAuthenticated,
        apiKey,
        apiBaseUrl,
        setApiKey,
        clearApiKey,
        testConnection,
    }
})