<template>
  <textarea
    :id="id"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :required="required"
    :rows="rows"
    :cols="cols"
    :aria-describedby="ariaDescribedBy"
    :aria-invalid="ariaInvalid"
    :class="textareaClasses"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    @blur="$emit('blur', $event)"
    @focus="$emit('focus', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  id?: string
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  rows?: number
  cols?: number
  ariaDescribedBy?: string
  ariaInvalid?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [event: FocusEvent]
  focus: [event: FocusEvent]
}>()

const textareaClasses = computed(() => [
  'input w-full min-h-[80px] resize-y',
])
</script>