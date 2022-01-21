/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const log = logger(module)

const filter: FilterCreator = ({ config }) => ({
  onFetch: async elements => {
    if (!config.fetch.includeTypes.includes('Fields')) {
      log.warn('Fields is not included in the fetch list so we cannot know what fields is in trash. Skipping the field_configuration_trashed_fields')
      return
    }

    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === 'FieldConfiguration')
      .filter(instance => instance.value.fields !== undefined)
      .forEach(instance => {
        const [fields, trashedFields] = _.partition(
          instance.value.fields,
          field => isReferenceExpression(field.id),
        )
        instance.value.fields = fields
        if (trashedFields.length !== 0) {
          log.debug(`Removed from ${instance.elemID.getFullName()} fields with ids: ${trashedFields.map(field => field.id).join(', ')}, because they are not references and thus assumed to be in trash`)
        }
      })
  },
})

export default filter
