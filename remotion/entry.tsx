/**
 * Remotion Player 入口（给中控台预览用）。
 *
 * 用 esbuild 打包成 console/ui/remotion-player.js，挂到 window.NutCutRemotion。
 * 不依赖中控台的 React，避免出现两份 React 实例。
 */
import React, {useEffect, useRef, useSyncExternalStore} from 'react'
import {createRoot} from 'react-dom/client'
import {Player, type PlayerRef} from '@remotion/player'
import {COMPOSITIONS} from './registry'

export type PlayerMountOptions = {
  composition: string
  inputProps?: Record<string, unknown>
  width?: number
  height?: number
  fps?: number
  durationInFrames?: number
  loop?: boolean
  autoplay?: boolean
}

type Store = {
  options: PlayerMountOptions
  ready: boolean
  player: PlayerRef | null
  listeners: Set<() => void>
  snapshot: number
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => number
  emit: () => void
  set: (next: Partial<PlayerMountOptions>) => void
}

function createStore(options: PlayerMountOptions): Store {
  const store: Store = {
    options,
    ready: false,
    player: null,
    listeners: new Set(),
    snapshot: 0,
    subscribe(listener) {
      store.listeners.add(listener)
      return () => store.listeners.delete(listener)
    },
    getSnapshot() {
      return store.snapshot
    },
    emit() {
      store.snapshot += 1
      for (const listener of store.listeners) listener()
    },
    set(next) {
      store.options = {...store.options, ...next}
      store.ready = false
      store.emit()
    },
  }
  return store
}

const Host: React.FC<{store: Store}> = ({store}) => {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const playerRef = useRef<PlayerRef>(null)
  const entry = COMPOSITIONS[store.options.composition] || COMPOSITIONS.TalkFrame
  const width = Number(store.options.width || entry.width)
  const height = Number(store.options.height || entry.height)
  const fps = Number(store.options.fps || entry.fps)
  const durationInFrames = Number(store.options.durationInFrames || entry.durationInFrames)

  useEffect(() => {
    store.player = playerRef.current
    store.ready = true
    store.emit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.options.composition])

  return (
    <Player
      ref={playerRef}
      component={entry.component}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={width}
      compositionHeight={height}
      inputProps={store.options.inputProps || entry.defaultProps}
      style={{width: '100%', height: '100%'}}
      controls={false}
      autoPlay={store.options.autoplay !== false}
      loop={store.options.loop !== false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
      acknowledgeRemotionLicense
    />
  )
}

type Mount = {
  root: ReturnType<typeof createRoot>
  store: Store
}

const mounts = new WeakMap<HTMLElement, Mount>()

export type RemotionHandle = {
  play: () => void
  pause: () => void
  toggle: () => void
  seekTo: (frame: number) => void
  getCurrentFrame: () => number
  isPlaying: () => boolean
  isReady: () => boolean
  setOptions: (next: Partial<PlayerMountOptions>) => void
}

function createHandle(mount: Mount): RemotionHandle {
  const withPlayer = (fn: (player: PlayerRef) => void) => {
    if (mount.store.player) fn(mount.store.player)
  }
  return {
    play: () => withPlayer((player) => player.play()),
    pause: () => withPlayer((player) => player.pause()),
    toggle: () => withPlayer((player) => (player.isPlaying() ? player.pause() : player.play())),
    seekTo: (frame) => withPlayer((player) => player.seekTo(Math.max(0, frame))),
    getCurrentFrame: () => (mount.store.player ? mount.store.player.getCurrentFrame() : 0),
    isPlaying: () => (mount.store.player ? mount.store.player.isPlaying() : false),
    isReady: () => mount.store.ready,
    setOptions: (next) => mount.store.set(next),
  }
}

const api = {
  mount(host: HTMLElement, options: PlayerMountOptions): RemotionHandle {
    if (!host) throw new Error('缺少 Remotion 挂载节点')
    const existing = mounts.get(host)
    if (existing) existing.root.unmount()
    const store = createStore(options)
    const root = createRoot(host)
    root.render(<Host store={store} />)
    const mount: Mount = {root, store}
    mounts.set(host, mount)
    return createHandle(mount)
  },
  unmount(host: HTMLElement) {
    const existing = mounts.get(host)
    if (!existing) return
    mounts.delete(host)
    existing.root.unmount()
  },
  list() {
    return Object.keys(COMPOSITIONS)
  },
}

declare global {
  interface Window {
    NutCutRemotion?: typeof api
  }
}

window.NutCutRemotion = api
export default api
