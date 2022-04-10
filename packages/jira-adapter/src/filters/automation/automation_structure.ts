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
import { InstanceElement, isInstanceElement, Values } from '@salto-io/adapter-api'
import { transformElement } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'

const { awu } = collections.asynciterable

const KEYS_TO_REMOVE = [
  'clientKey',
  'updated',
  'parentId',
  'ruleScope',
  'conditionParentId',
]

const removeRedundantKeys = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path }) => (
      KEYS_TO_REMOVE.includes(path !== undefined ? path.name : '')
        ? undefined
        : value
    ),
  })).value
}

const removeInnerIds = async (instance: InstanceElement): Promise<void> => {
  instance.value = (await transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: async ({ value, path }) => (
      path !== undefined && path.name === 'id' && !path.createParentID().isTopLevel()
        ? undefined
        : value
    ),
  })).value
}


const filter: FilterCreator = () => ({
  onFetch: async elements =>
    awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
      .forEach(async instance => {
        instance.value = await elementUtils.removeNullValues(
          instance.value,
          await instance.getType()
        )
        await removeRedundantKeys(instance)
        await removeInnerIds(instance)

        instance.value.projects = instance.value.projects
          ?.map(
            ({ projectId, projectTypeKey }: Values) => (
              projectId !== undefined
                ? { projectId }
                : { projectTypeKey })
          )
      }),
})

export default filter
