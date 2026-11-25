import test from 'node:test'
import assert from 'node:assert/strict'
import { orientationOf, normalizeSpec, projectRenderBlock } from '../src/spec.mjs'

test('portrait 1080p spec', () => {
  const result = normalizeSpec({ orientation: 'portrait', quality: '1080p', fps: 30, duration: 30, audio: 'source' })
  assert.equal(result.ok, true)
  assert.equal(result.spec.width, 1080)
  assert.equal(result.spec.height, 1920)
  assert.equal(result.spec.orientationLabel, '竖屏')
  assert.equal(result.spec.confirmed, true)
})

test('size infers orientation', () => {
  const result = normalizeSpec({ size: '720x1280', fps: 30, duration: 12 })
  assert.equal(result.ok, true)
  assert.equal(result.spec.orientation, 'portrait')
  assert.equal(result.spec.width, 720)
})

test('missing orientation is rejected with questions', () => {
  const result = normalizeSpec({ duration: 30, fps: 30 })
  assert.equal(result.ok, false)
  assert.ok(result.questions.length >= 5)
})

test('missing duration is rejected', () => {
  const result = normalizeSpec({ orientation: 'landscape', quality: '1080p', fps: 30 })
  assert.equal(result.ok, false)
  assert.match(result.error, /时长/)
})

test('unknown quality is rejected when no custom size', () => {
  const result = normalizeSpec({ orientation: 'landscape', quality: '2k', fps: 30, duration: 10 })
  assert.equal(result.ok, false)
  assert.match(result.error, /分辨率/)
})

test('orientationOf', () => {
  assert.equal(orientationOf(1920, 1080), 'landscape')
  assert.equal(orientationOf(1080, 1920), 'portrait')
  assert.equal(orientationOf(1080, 1080), 'square')
})

test('projectRenderBlock', () => {
  assert.match(projectRenderBlock({}), /规格/)
  assert.match(projectRenderBlock({ spec: { confirmed: true }, layoutAdapted: false }), /版式/)
  assert.equal(projectRenderBlock({ spec: { confirmed: true }, layoutAdapted: true }), null)
  assert.equal(projectRenderBlock({ spec: { confirmed: true } }), null)
})
