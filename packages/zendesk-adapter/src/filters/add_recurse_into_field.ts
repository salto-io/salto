/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { Element, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { FETCH_CONFIG } from '../config'

type RecurseIntoFieldComponent = {
  recurseIntoFields: { fieldName: string }[]
}

const recurseIntoFieldMap: Record<string, RecurseIntoFieldComponent> = {
  business_hours_schedule: {
    recurseIntoFields: [
      {
        fieldName: 'holidays',
      },
    ],
  },
  routing_attribute: {
    recurseIntoFields: [
      {
        fieldName: 'values',
      },
    ],
  },
  custom_object: {
    recurseIntoFields: [
      {
        fieldName: 'custom_object_fields',
      },
    ],
  },
}

/*
 * As part of the migration to the new infra (SALTO-5761), there are some types for whom the
 * 'recurseInto' fields get omitted when no values are present (details: SALTO-5860).
 * While this is 'correct' behavior, it diverges from the behavior of the old infra, which means it creates a diff
 * while fetching for clients.  * We would like to not have diff, so in this filter we re-add the omitted fields.
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'addRecurseIntoField',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (config[FETCH_CONFIG].useNewInfra !== true) {
      return
    }

    elements.filter(isInstanceElement).forEach(element => {
      const fields = recurseIntoFieldMap[element.elemID.typeName]
      if (fields === undefined) {
        return
      }
      fields.recurseIntoFields.forEach(field => {
        if (element.value[field.fieldName] === undefined) {
          element.value[field.fieldName] = []
        }
      })
    })
  },
})

export default filterCreator
