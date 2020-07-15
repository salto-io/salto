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

import { DetailedChange } from '@salto-io/adapter-api'

export type Trigger = {
  name: string
  elementIdsRegex: string[]
}

const triggerMatch = (trigger: Trigger, fullName: string): boolean => trigger.elementIdsRegex
  .some((elementIdRegex: string) => fullName.match(new RegExp(elementIdRegex)))

export const mapTriggerNameToChanges = (triggers: Array<Trigger>, changes: DetailedChange[]):
  Record<string, DetailedChange[]> => {
  const triggerNameToChanges: Record<string, DetailedChange[]> = {}
  triggers.forEach((trigger: Trigger) => {
    changes.forEach((change: DetailedChange) => {
      if (triggerMatch(trigger, change.id.getFullName())) {
        if (!triggerNameToChanges[trigger.name]) triggerNameToChanges[trigger.name] = []
        triggerNameToChanges[trigger.name].push(change)
      }
    })
  })
  return triggerNameToChanges
}
