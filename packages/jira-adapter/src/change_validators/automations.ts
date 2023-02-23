/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isAdditionChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE } from '../constants'

const { awu } = collections.asynciterable

const log = logger(module)

export const automationsValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    log.warn('Elements source was not passed to automationsValidator. Skipping validator')
    return []
  }

  const nameToAutomations = await awu(await elementsSource.list())
    .filter(id => id.typeName === AUTOMATION_TYPE && id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .groupBy(instance => instance.value.name)


  return changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .filter(instance => nameToAutomations[instance.value.name].length > 1)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Automation name is already in use',
      detailedMessage: `The automation name “${instance.value.name}” is already used by other automations in the target environment. To deploy this automation using Salto, rename it and try again.`,
    }))
}
