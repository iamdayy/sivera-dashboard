import Dashboard from '@/views/Dashboard/Index.vue'
import LandingPage from '@/views/LandingPage.vue'
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'LandingPage',
    component: LandingPage
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    // This route will have child routes for different sections
    children: [
      {
        path: '',
        name: 'DashboardHome',
        component: () => import('@/views/Dashboard/Home.vue')
      },
      {
        path: 'cameras',
        name: 'Cameras',
        component: () => import('@/views/Dashboard/Cameras.vue')
      },
      {
        path: 'cameras/:id/calibration',
        name: 'CameraCalibration',
        component: () => import('@/views/Dashboard/CalibrationUnified.vue'),
        meta: { requiresCamera: true }
      },
      {
        path: 'predictions',
        name: 'Predictions',
        component: () => import('@/views/Dashboard/Predictions.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Dashboard/Settings.vue')
      }
    ]
  },
  // Redirect old routes to cameras page
  {
    path: '/dashboard/calibrations',
    redirect: '/dashboard/cameras'
  },
  {
    path: '/dashboard/ground-references',
    redirect: '/dashboard/cameras'
  },
  {
    path: '/dashboard/depth-scales',
    redirect: '/dashboard/cameras'
  }
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})