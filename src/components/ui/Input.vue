<template>
  <input
    :id="id"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :autocomplete="autocomplete"
    :spellcheck="spellcheck"
    :maxlength="maxlength"
    :min="min"
    :max="max"
    :step="step"
    :aria-describedby="ariaDescribedBy"
    :aria-invalid="ariaInvalid"
    :class="inputClasses"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @blur="$emit('blur', $event)"
    @focus="$emit('focus', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  id?: string
  modelValue?: string | number
  type?: 'text' | 'password' | 'email' | 'number' | 'url' | 'tel'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  ariaDescribedBy?: string
  ariaInvalid?: boolean
  autocomplete?: string
  spellcheck?: boolean
  maxlength?: number
  min?: string | number
  max?: string | number
  step?: string | number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const inputClasses = computed(() => [
  'input w-full',
  {
    'input-sm': false,
  }
])
</script>