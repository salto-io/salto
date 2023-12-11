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
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { ASSETS_OBJECT_TYPE, PROJECT_TYPE, SERVICE_DESK } from '../constants'

type ObjectWithId = {
  id: number
}
const OBJECT_RESPONSE_SCHEME = Joi.object({
  id: Joi.number().required(),
}).unknown(true).required()

const isObjectWithId = createSchemeGuard<ObjectWithId>(OBJECT_RESPONSE_SCHEME)

const filter: FilterCreator = () => ({
  name: 'changeJSMElementsFieldFilter',
  onFetch: async elements => {
    const instanceElements = elements.filter(isInstanceElement)

    instanceElements
      .filter(e => e.elemID.typeName === PROJECT_TYPE)
      .filter(project => project.value.projectTypeKey === SERVICE_DESK)
      .filter(project => project.value.serviceDeskId !== undefined)
      .forEach(project => {
        project.value.serviceDeskId = isObjectWithId(project.value.serviceDeskId)
          ? project.value.serviceDeskId.id : project.value.serviceDeskId
      })

    instanceElements
      .filter(e => e.elemID.typeName === ASSETS_OBJECT_TYPE)
      .forEach(instance => {
        instance.value.iconId = isObjectWithId(instance.value.icon) ? instance.value.icon.id : instance.value.icon
        delete instance.value.icon
      })
  },
})
export default filter
