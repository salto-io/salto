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
import _ from 'lodash'
import { isInstanceElement, ReferenceExpression } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { AUTOMATION_TYPE_NAME } from '../change_validators/automation_all_conditions'

const POTENTIAL_BAD_FORMAT_TYPES = [AUTOMATION_TYPE_NAME, 'trigger']
const POTENTIAL_BAD_FORMAT_KEY = 'actions'
const POTENTIAL_BAD_FORMAT_FIELD = 'notification_webhook'

const handleStringValue = ({ value }:
{
 value: string
}): string | [ReferenceExpression, ...unknown[]] => {
  try {
    const fixedValue = JSON.parse(value.replace(/\\\[/g, '[').replace(/\\\]/g, ']'))
    return fixedValue
  } catch (e) {
    // do nothing
  }
  return value
}

const filter: FilterCreator = () => ({
  name: 'tempName',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    POTENTIAL_BAD_FORMAT_TYPES.forEach(instanceType => {
      const relevantInstances = instances.filter(instance => instance.elemID.typeName === instanceType)
      relevantInstances.forEach(instance => {
        const actions = instance.value[POTENTIAL_BAD_FORMAT_KEY]
        if (!_.isArray(actions)) {
          return
        }
        actions.filter(action => action.field === POTENTIAL_BAD_FORMAT_FIELD).forEach(action => {
          const { value } = action
          if (_.isString(value)) {
            action.value = handleStringValue({ value })
          }
        })
      })
    })
  },
})

export default filter
