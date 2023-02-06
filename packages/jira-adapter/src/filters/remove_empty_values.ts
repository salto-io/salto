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
import { isInstanceElement } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { DASHBOARD_GADGET_TYPE, NOTIFICATION_SCHEME_TYPE_NAME, WEBHOOK_TYPE, WORKFLOW_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const RELEVANT_TYPES: string[] = [
  WORKFLOW_TYPE_NAME,
  DASHBOARD_GADGET_TYPE,
  WEBHOOK_TYPE,
  NOTIFICATION_SCHEME_TYPE_NAME,
]

const filter: FilterCreator = () => ({
  name: 'removeEmptyValuesFilter',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => RELEVANT_TYPES.includes(instance.elemID.typeName))
      .forEach(async instance => {
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          transformFunc: ({ value }) => value,
          strict: false,
          allowEmpty: false,
        }) ?? {}
      })
  },
})

export default filter
