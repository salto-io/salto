/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { existsSync, readFileSync } from 'fs'
import _ from 'lodash'
import { parse } from '@salto-io/core'
import { InstanceElement } from '@salto-io/adapter-api'
import { Trigger } from './trigger'
import { Notification, SMTP } from './notification'

export interface Config {
  env: string
  triggers: Trigger[]
  notifications: Notification[]
  smtp: SMTP
}

const validateConfigFileExists = (filePath: string): void => {
  if (!existsSync(filePath)) {
    throw new Error(`Config file ${filePath} does not exist`)
  }
}

const validateRegex = (config: Config): void => {
  config.triggers.forEach((trigger: Trigger) => {
    trigger.elementIdsRegex.forEach((regex: string) => {
      try {
        // eslint-disable-next-line no-new
        new RegExp(regex)
      } catch (e) {
        throw new Error(`Invalid regex "${regex}" in ${trigger.name} trigger`)
      }
    })
  })
}

const validateTriggerNames = (config: Config): void => {
  const triggerNameToTrigger = _.keyBy(config.triggers, (t: Trigger) => t.name)
  config.notifications.forEach((notification: Notification) => {
    notification.triggers.forEach((triggerName: string) => {
      if (!triggerNameToTrigger[triggerName]) {
        throw new Error(`Invalid trigger name "${triggerName}"`)
      }
    })
  })
}

export const validateConfig = (config: Config): void => {
  validateRegex(config)
  validateTriggerNames(config)
}

export const readConfigFile = async (filePath: string): Promise<Config> => {
  validateConfigFileExists(filePath)
  const config = await parse(readFileSync(filePath), filePath)
  if (config.errors.length > 0) {
    throw new Error(`Failed to read configuration file ${filePath}`)
  }
  const elements = config.elements[0] as InstanceElement
  return elements.value as Config
}
