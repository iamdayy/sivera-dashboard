import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import { openDialogs } from '@/composables/useDialogStack'

const wrappers: VueWrapper[] = []
const containers: HTMLElement[] = []
const frames = new Map<number, FrameRequestCallback>()
const scrollIntoView = vi.fn()
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
let frameId = 0
let initialOverflow = ''

function runFrame() {
  const pending = [...frames.entries()]
  for (const [id, callback] of pending) {
    frames.delete(id)
    callback(0)
  }
}

async function openDialog(name = 'fixture') {
  const container = document.createElement('div')
  document.body.append(container)
  containers.push(container)
  const wrapper = mount(Dialog, {
    props: { open: true },
    attachTo: container,
    slots: { default: () => h('div', [
      h('input', { id: `${name}-first` }),
      h('input', { id: `${name}-last` }),
      h('button', { disabled: true }, 'Tidak tersedia'),
      h('details', [h('summary', 'Rincian'), h('button', 'Tindakan tersembunyi')]),
    ]) },
  })
  wrappers.push(wrapper)
  await nextTick()
  runFrame()
  runFrame()
  scrollIntoView.mockClear()
  const first = document.getElementById(`${name}-first`)!
  const last = document.getElementById(`${name}-last`)!
  const root = first.closest<HTMLElement>('[role="dialog"]')!
  return { wrapper, first, last, root }
}

beforeEach(() => {
  initialOverflow = document.body.style.overflow
  frames.clear()
  frameId = 0
  scrollIntoView.mockClear()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frames.set(++frameId, callback)
    return frameId
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    if (this.closest('details') && this.tagName !== 'SUMMARY') return Object.assign([], { item: () => null })
    const rect = new DOMRect(0, 0, 100, 44)
    return Object.assign([rect], { item: (index: number) => index === 0 ? rect : null })
  })
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0).reverse()) wrapper.unmount()
  for (const container of containers.splice(0)) container.remove()
  expect(openDialogs).toEqual([])
  expect(frames.size).toBe(0)
  document.body.style.overflow = initialOverflow
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('dialog focus visibility', () => {
  it('defers focusin scrolling until the next rendering frame and uses nearest alignment', async () => {
    const { first, last } = await openDialog()
    expect(document.activeElement).toBe(first)
    last.focus({ preventScroll: true })
    expect(frames.size).toBe(1)
    expect(scrollIntoView).not.toHaveBeenCalled()
    runFrame()
    expect(scrollIntoView).not.toHaveBeenCalled()
    runFrame()
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest', inline: 'nearest' })
    expect(scrollIntoView.mock.contexts[0]).toBe(last)
  })

  it('coalesces resize/focus events and scrolls the current field rather than a captured old focus', async () => {
    const { first, last } = await openDialog()
    window.dispatchEvent(new Event('resize'))
    runFrame()
    last.focus({ preventScroll: true })
    window.dispatchEvent(new Event('resize'))
    expect(frames.size).toBe(1)
    runFrame()
    expect(scrollIntoView).not.toHaveBeenCalled()
    first.focus({ preventScroll: true })
    runFrame()
    runFrame()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(first)
  })

  it('does not scroll focus outside the dialog after a resize', async () => {
    await openDialog()
    const outside = document.createElement('button')
    document.body.append(outside)
    containers.push(outside)
    outside.focus()
    window.dispatchEvent(new Event('resize'))
    runFrame()
    runFrame()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('lets only the top dialog scroll, even if underlying focus changes before the frame runs', async () => {
    const lower = await openDialog('lower')
    await openDialog('upper')
    lower.last.focus({ preventScroll: true })
    window.dispatchEvent(new Event('resize'))
    runFrame()
    runFrame()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('scrolls the top dialog once and resumes the lower dialog after the top one closes', async () => {
    const lower = await openDialog('lower')
    const upper = await openDialog('upper')
    upper.last.focus({ preventScroll: true })
    window.dispatchEvent(new Event('resize'))
    runFrame()
    runFrame()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(upper.last)
    await upper.wrapper.setProps({ open: false })
    runFrame()
    runFrame()
    scrollIntoView.mockClear()
    lower.last.focus({ preventScroll: true })
    runFrame()
    runFrame()
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView.mock.contexts[0]).toBe(lower.last)
  })

  it.each([0, 1])('cancels pending visibility work when closed after %s frame(s)', async count => {
    const { wrapper, last } = await openDialog()
    last.focus({ preventScroll: true })
    for (let i = 0; i < count; i++) runFrame()
    await wrapper.setProps({ open: false })
    expect(frames.size).toBe(0)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('removes resize and keydown listeners and cancels deferred scrolling on unmount', async () => {
    const { wrapper, last } = await openDialog()
    last.focus({ preventScroll: true })
    runFrame()
    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    expect(frames.size).toBe(0)
    window.dispatchEvent(new Event('resize'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(frames.size).toBe(0)
    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('traps Tab in both directions through native summaries without focusing disabled or collapsed controls', async () => {
    const { root } = await openDialog()
    const close = root.querySelector<HTMLElement>('[aria-label="Tutup dialog"]')!
    const summary = root.querySelector('summary')!
    close.focus()
    const backwards = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true, bubbles: true })
    close.dispatchEvent(backwards)
    expect(backwards.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(summary)
    const forwards = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true })
    summary.dispatchEvent(forwards)
    expect(forwards.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close)
  })
})
