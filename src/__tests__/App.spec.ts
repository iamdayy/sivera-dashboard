import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from '../App.vue'
import LandingPage from '../views/LandingPage.vue'
import Dashboard from '../views/Dashboard/Index.vue'
import Home from '../views/Dashboard/Home.vue'
import Cameras from '../views/Dashboard/Cameras.vue'
import Calibrations from '../views/Dashboard/Calibrations.vue'
import GroundReferences from '../views/Dashboard/GroundReferences.vue'
import Predictions from '../views/Dashboard/Predictions.vue'
import Settings from '../views/Dashboard/Settings.vue'

const routes = [
  { path: '/', component: LandingPage },
  { path: '/dashboard', component: Dashboard, children: [
    { path: '', component: Home },
    { path: 'cameras', component: Cameras },
    { path: 'calibrations', component: Calibrations },
    { path: 'ground-references', component: GroundReferences },
    { path: 'predictions', component: Predictions },
    { path: 'settings', component: Settings },
  ]},
]

const router = createRouter({ history: createWebHistory(), routes })

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mounts without errors', () => {
    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders landing page at root', async () => {
    router.push('/')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('Sivera Dashboard')
  })

  it('renders dashboard home at /dashboard', async () => {
    router.push('/dashboard')
    await router.isReady()
    const wrapper = mount(App, { global: { plugins: [router] } })
    expect(wrapper.text()).toContain('Dashboard')
  })
})