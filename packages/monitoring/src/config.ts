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
import uuidv4 from 'uuid/v4'
import { parser } from '@salto-io/workspace'
import { InstanceElement } from '@salto-io/adapter-api'
import { telemetrySender, Telemetry } from '@salto-io/core'
import { Trigger } from './trigger'

const { parse } = parser

export interface Config {
  triggers: Trigger[]
  notifications: Notification[]
  smtp: SMTP
  slack: Slack
  telemetry: TelemetryConfig
}

export type TelemetryConfig = {
  id: string
  url: string
  token: string
  enabled: boolean
}

export type NotificationType = string
export const EmailNotificationType: NotificationType = 'email'
export const SlackNotificationType: NotificationType = 'slack'

export type Notification = {
  type: NotificationType
  title: string
  from: string
  to: string[]
  triggers: string[]
}

export type SMTP = {
  host: string
  port: number
  ssl: boolean
  username: string
  password: string
}

export type Slack = {
  token: string
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

const validateNotificationTypeConfig = (config: Config): void => {
  const notificationTypes = config.notifications.map(n => n.type)
  if (notificationTypes.includes(EmailNotificationType) && _.isUndefined(config.smtp)) {
    throw new Error('smtp config is required for email notification')
  }
  if (notificationTypes.includes(SlackNotificationType) && _.isUndefined(config.slack)) {
    throw new Error('slack config is required for slack notification')
  }
}

export const getTelemetry = (config: Config): Telemetry => telemetrySender(
  config.telemetry,
  {
    installationID: config.telemetry.id,
    app: 'monitoring',
    sessionID: uuidv4(),
  }
)

export const validateConfig = (config: Config): void => {
  validateRegex(config)
  validateTriggerNames(config)
  validateNotificationTypeConfig(config)
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
