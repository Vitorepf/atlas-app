import { createTamagui } from 'tamagui'
import { config } from '@tamagui/config/v3'

const appConfig = createTamagui(config)

export type Conf = typeof appConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

export default appConfig
