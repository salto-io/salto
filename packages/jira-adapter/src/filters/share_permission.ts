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
import { BuiltinTypes, Change, Element, ElemID, Field, InstanceElement, isInstanceChange, isInstanceElement, isObjectType, ObjectType, ReadOnlyElementsSource, Values } from '@salto-io/adapter-api'
import { applyFunctionToChangeData, transformValues } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { JIRA } from '../constants'
import { FilterCreator } from '../filter'
import { setFieldDeploymentAnnotations } from '../utils'

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
      id: {
        refType: BuiltinTypes.STRING,
      },
    },
    path: [JIRA, elementUtils.TYPES_PATH, 'ProjectPermission'],
  })

  setFieldDeploymentAnnotations(projectPermissionType, 'id')

  sharePermissionType.fields.project = new Field(sharePermissionType, 'project', projectPermissionType)

  const projectRolePermissionType = new ObjectType({
    elemID: new ElemID(JIRA, 'ProjectRolePermission'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, elementUtils.TYPES_PATH, 'ProjectRolePermission'],
  })

  setFieldDeploymentAnnotations(projectRolePermissionType, 'id')

  sharePermissionType.fields.role = new Field(sharePermissionType, 'role', projectRolePermissionType)

  elements.push(projectPermissionType, projectRolePermissionType)
}

const transformSharePermissionValues = (sharePermissionValues: Values): void => {
  // On fetch we get 'loggedin' and on deploy we need to
  // send 'authenticated' (which means the same thing)
  sharePermissionValues.type = sharePermissionValues.type === 'loggedin' ? 'authenticated' : sharePermissionValues.type

  if (sharePermissionValues.project !== undefined) {
    sharePermissionValues.project = { id: sharePermissionValues.project?.id }
  }

  if (sharePermissionValues.role !== undefined) {
    sharePermissionValues.role = { id: sharePermissionValues.role?.id }
  }
}

const transformSharedPermissions = async (
  instance: InstanceElement,
  func: (sharedPermission: Values) => void,
  elementsSource: ReadOnlyElementsSource,
): Promise<void> => {
  await transformValues({
    values: instance.value,
    type: await instance.getType(elementsSource),
    strict: false,
    allowEmpty: true,
    elementsSource,
    transformFunc: async ({ value, field }) => {
      if ((await field?.getType(elementsSource))?.elemID.typeName === 'SharePermission') {
        func(value)
        return undefined
      }
      return value
    },
  })
}

/**
 * Change SharePermission structure to fit the deployment endpoint
 */
const filter: FilterCreator = ({ elementsSource }) => ({
  name: 'sharePermissionFilter',
  onFetch: async (elements: Element[]) => {
    transformType(elements)

    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        await transformSharedPermissions(instance, transformSharePermissionValues, elementsSource)
      })
  },

  preDeploy: async changes =>
    awu(changes)
      .filter(isInstanceChange)
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          async instance => {
            await transformSharedPermissions(
              instance,
              sharedPermission => {
                if (sharedPermission.type === 'project' && sharedPermission.role !== undefined) {
                  sharedPermission.type = 'projectRole'
                }
              },
              elementsSource,
            )
            return instance
          }
        )),

  onDeploy: async changes =>
    awu(changes)
      .filter(isInstanceChange)
      .forEach(change =>
        applyFunctionToChangeData<Change<InstanceElement>>(
          change,
          async instance => {
            await transformSharedPermissions(
              instance,
              sharedPermission => {
                if (sharedPermission.type === 'projectRole') {
                  sharedPermission.type = 'project'
                }
              },
              elementsSource
            )
            return instance
          }
        )),
})

export default filter
