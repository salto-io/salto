/*
*                      Copyright 2021 Salto Labs Ltd.
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
/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, Element, ElemID, Field, isInstanceElement, isObjectType, ObjectType, Values } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { JIRA } from '../constants'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const log = logger(module)

const transformType = (elements: Element[]): void => {
  const sharePermissionType = elements.filter(isObjectType).find((type => type.elemID.typeName === 'SharePermission'))
  if (sharePermissionType === undefined) {
    log.warn('SharePermission type was not found during fetch')
    return
  }
  const projectPermissionType = new ObjectType({
    elemID: new ElemID(JIRA, 'ProjectPermission'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elementUtils.TYPES_PATH, 'ProjectPermission'],
  })

  sharePermissionType.fields.project = new Field(sharePermissionType, 'project', projectPermissionType)

  const projectRolePermissionType = new ObjectType({
    elemID: new ElemID(JIRA, 'ProjectRolePermission'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elementUtils.TYPES_PATH, 'ProjectRolePermission'],
  })

  sharePermissionType.fields.role = new Field(sharePermissionType, 'role', projectRolePermissionType)

  elements.push(projectPermissionType, projectRolePermissionType)
}

const transformSharePermissionValues = (sharePermissionValues: Values): void => {
  // On fetch we get 'loggedin' and on deploy we need to
  // send 'authenticated' (which means the same thing)
  sharePermissionValues.type = sharePermissionValues.type === 'loggedin' ? 'authenticated' : sharePermissionValues.type

  if (sharePermissionValues.project !== undefined) {
    sharePermissionValues.project = _.pick(sharePermissionValues.project, 'id')
  }

  if (sharePermissionValues.role !== undefined) {
    sharePermissionValues.role = _.pick(sharePermissionValues.role, 'id')
  }
}

/**
 * Change SharePermission structure to fit the deployment endpoint
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    transformType(elements)

    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          strict: false,
          allowEmpty: true,
          transformFunc: async ({ value, field }) => {
            if ((await field?.getType())?.elemID.typeName === 'SharePermission') {
              transformSharePermissionValues(value)
            }
            return value
          },
        }) ?? {}
      })
  },
})

export default filter
