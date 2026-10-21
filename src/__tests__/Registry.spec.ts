import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

describe('registry primitives', () => {
  it('merges conflicting Tailwind overrides', () => {
    expect(cn('p-6 bg-white', 'p-4 bg-muted')).toBe('p-4 bg-muted')
  })

  it('uses a non-submit default and forwards disabled and explicit type', () => {
    const wrapper = mount(Button, { slots: { default: 'Simpan' } })
    expect(wrapper.attributes('type')).toBe('button')
    const submit = mount(Button, { attrs: { type: 'submit', disabled: true } })
    expect(submit.attributes('type')).toBe('submit')
    expect(submit.element).toHaveProperty('disabled', true)
  })

  it('preserves empty input without coercing it to zero', async () => {
    const wrapper = mount(Input, { props: { modelValue: 12.5 }, attrs: { type: 'number' } })
    await wrapper.setValue('')
    const updates = wrapper.emitted('update:modelValue')
    expect(updates?.[updates.length - 1]).toEqual([''])
  })
})
