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


import { isObjectType, CORE_ANNOTATIONS, isInstanceElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { CALENDAR_TYPE, CUSTOMER_PERMISSIONS_TYPE, PORTAL_GROUP_TYPE, QUEUE_TYPE, REQUEST_TYPE_NAME } from '../constants'
import { setTypeDeploymentAnnotations, addAnnotationRecursively } from '../utils'


const jsmSupportedTypes = [
  CUSTOMER_PERMISSIONS_TYPE,
  QUEUE_TYPE,
  CALENDAR_TYPE,
  REQUEST_TYPE_NAME,
  PORTAL_GROUP_TYPE]

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'jsmTypesFetchFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    elements
      .filter(e => jsmSupportedTypes.includes(e.elemID.typeName))
      .filter(isObjectType)
      .map(async obj => {
        setTypeDeploymentAnnotations(obj)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.CREATABLE)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.UPDATABLE)
        await addAnnotationRecursively(obj, CORE_ANNOTATIONS.DELETABLE)
      })
    elements
      .filter(e => jsmSupportedTypes.includes(e.elemID.typeName))
      .filter(isInstanceElement)
      .forEach(inst => {
        inst.annotations[CORE_ANNOTATIONS.PARENT] = [inst.value.projectKey]
        delete inst.value.projectKey
      })
  },
})

export default filterCreator
