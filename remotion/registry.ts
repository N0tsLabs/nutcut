import type React from 'react'
import {TalkFrame, talkFrameDefaults} from './compositions/TalkFrame'
import {TalkRail, talkRailDefaults} from './compositions/TalkRail'
import {TalkBubble, talkBubbleDefaults} from './compositions/TalkBubble'
import {PhotoStory, photoStoryDefaults} from './compositions/PhotoStory'
import {PhotoSplit, photoSplitDefaults} from './compositions/PhotoSplit'
import {VideoMontage, videoMontageDefaults} from './compositions/VideoMontage'
import {VideoLowerThird, videoLowerThirdDefaults} from './compositions/VideoLowerThird'
import {DataConsole, dataConsoleDefaults} from './compositions/DataConsole'
import {KineticTitle, kineticTitleDefaults} from './compositions/KineticTitle'
import type {ReelProps} from './types'

export type CompositionEntry = {
  id: string
  component: React.FC<ReelProps>
  defaultProps: ReelProps
  width: number
  height: number
  fps: number
  durationInFrames: number
}

export const COMPOSITIONS: Record<string, CompositionEntry> = {
  TalkFrame: {id: 'TalkFrame', component: TalkFrame, defaultProps: talkFrameDefaults, width: 1080, height: 1920, fps: 30, durationInFrames: 300},
  TalkRail: {id: 'TalkRail', component: TalkRail, defaultProps: talkRailDefaults, width: 1920, height: 1080, fps: 30, durationInFrames: 300},
  TalkBubble: {id: 'TalkBubble', component: TalkBubble, defaultProps: talkBubbleDefaults, width: 1080, height: 1920, fps: 30, durationInFrames: 300},
  PhotoStory: {id: 'PhotoStory', component: PhotoStory, defaultProps: photoStoryDefaults, width: 1080, height: 1920, fps: 30, durationInFrames: 300},
  PhotoSplit: {id: 'PhotoSplit', component: PhotoSplit, defaultProps: photoSplitDefaults, width: 1080, height: 1920, fps: 30, durationInFrames: 300},
  VideoMontage: {id: 'VideoMontage', component: VideoMontage, defaultProps: videoMontageDefaults, width: 1920, height: 1080, fps: 30, durationInFrames: 300},
  VideoLowerThird: {id: 'VideoLowerThird', component: VideoLowerThird, defaultProps: videoLowerThirdDefaults, width: 1920, height: 1080, fps: 30, durationInFrames: 300},
  DataConsole: {id: 'DataConsole', component: DataConsole, defaultProps: dataConsoleDefaults, width: 1920, height: 1080, fps: 30, durationInFrames: 300},
  KineticTitle: {id: 'KineticTitle', component: KineticTitle, defaultProps: kineticTitleDefaults, width: 1920, height: 1080, fps: 30, durationInFrames: 300},
}

export const COMPOSITION_IDS = Object.keys(COMPOSITIONS)
