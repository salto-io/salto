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

import { DetailedChange } from '@salto-io/core'

export type Trigger = {
  name: string
  title: string
  elementIdsRegex: string[]
  triggeredBy: DetailedChange[]
}

export const triggered = (trigger: Trigger): boolean => {
  if (!trigger.triggeredBy) return false
  return trigger.triggeredBy.length > 0
}

const triggerMatch = (trigger: Trigger, fullName: string): boolean => trigger.elementIdsRegex
  .some((elementIdRegex: string) => fullName.match(new RegExp(elementIdRegex)))

export const checkTriggers = (triggers: Array<Trigger>, changes: DetailedChange[]): void => {
  triggers.forEach((trigger: Trigger) => {
    changes.forEach((change: DetailedChange) => {
      if (triggerMatch(trigger, change.id.getFullName())) {
        if (!trigger.triggeredBy) trigger.triggeredBy = []
        trigger.triggeredBy.push(change)
      }
    })
  })
}
