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
    path: '/public/cameras/:cameraId',
    name: 'PublicCameraView',
    component: () => import('@/views/Public/CameraView.vue'),
    meta: { public: true }
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
        path: 'predictions',
        name: 'Predictions',
        component: () => import('@/views/Dashboard/Predictions.vue')
      },
      {
        path: 'cameras/:id/calibration',
        name: 'CameraCalibration',
        component: () => import('@/views/Dashboard/CalibrationUnified.vue'),
        meta: { requiresCamera: true }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Dashboard/Settings.vue')
      }
    ]
  },
  // Legacy section paths render the unified calibration workflow (camera via ?camera=).
  {
    path: '/dashboard/calibrations',
    name: 'Calibrations',
    component: () => import('@/views/Dashboard/CalibrationUnified.vue')
  },
  {
    path: '/dashboard/ground-references',
    name: 'GroundReferences',
    component: () => import('@/views/Dashboard/CalibrationUnified.vue')
  },
  {
    path: '/dashboard/depth-scales',
    name: 'DepthScales',
    component: () => import('@/views/Dashboard/CalibrationUnified.vue')
  }
]

export default createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})