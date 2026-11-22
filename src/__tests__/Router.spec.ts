import { describe, expect, it } from 'vitest'
import router from '@/router'

describe('router', () => {
  it('resolves /dashboard/predictions (P2-1 regression)', async () => {
    const resolved = router.resolve({ path: '/dashboard/predictions', query: { camera: 'cam-1', job: 'job-1' } })
    expect(resolved.name).toBe('Predictions')
    expect(resolved.matched.length).toBeGreaterThan(0)
  })

  it('legacy section paths render the unified calibration workflow', () => {
    for (const [path, name] of [
      ['/dashboard/calibrations', 'Calibrations'],
      ['/dashboard/ground-references', 'GroundReferences'],
      ['/dashboard/depth-scales', 'DepthScales'],
    ] as const) {
      const resolved = router.resolve({ path, query: { camera: 'cam-1' } })
      expect(resolved.name).toBe(name)
      expect(resolved.matched.length).toBeGreaterThan(0)
    }
  })
})
