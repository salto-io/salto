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
import {
  BuiltinTypes,
  Element,
  ElemID,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isObjectType,
  ObjectType,
  Values,
} from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { DASHBOARD_TYPE, FILTER_TYPE_NAME, JIRA } from '../constants'
import { FilterCreator } from '../filter'
import { setFieldDeploymentAnnotations } from '../utils'

const log = logger(module)

const SHARE_PERMISSION_FIELDS = ['sharePermissions', 'editPermissions']
const SHARE_PERMISSION_TYPES = [DASHBOARD_TYPE, FILTER_TYPE_NAME]

const transformType = (elements: Element[]): void => {
  const sharePermissionType = elements.filter(isObjectType).find(type => type.elemID.typeName === 'SharePermission')
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
    sharePermissionValues.project = { id: sharePermissionValues.project.id }
  }

  if (sharePermissionValues.role !== undefined) {
    sharePermissionValues.role = { id: sharePermissionValues.role.id }
  }
}

const transformSharedPermissions = (instance: InstanceElement, func: (sharedPermission: Values) => void): void => {
  SHARE_PERMISSION_FIELDS.forEach(field => {
    if (Array.isArray(instance.value[field])) {
      instance.value[field].forEach(func)
    }
  })
}

const isSharePermissionType = (instance: InstanceElement): boolean =>
  SHARE_PERMISSION_TYPES.includes(instance.elemID.typeName)

/**
 * Change SharePermission structure to fit the deployment endpoint
 */
const filter: FilterCreator = () => ({
  name: 'sharePermissionFilter',
  onFetch: async (elements: Element[]) => {
    transformType(elements)

    elements
      .filter(isInstanceElement)
      .filter(isSharePermissionType)
      .forEach(instance => transformSharedPermissions(instance, transformSharePermissionValues))
  },

  preDeploy: async changes =>
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isSharePermissionType)
      .forEach(instance =>
        transformSharedPermissions(instance, sharedPermission => {
          if (sharedPermission.type === 'project' && sharedPermission.role !== undefined) {
            sharedPermission.type = 'projectRole'
          }
        }),
      ),

  onDeploy: async changes =>
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isSharePermissionType)
      .forEach(instance =>
        transformSharedPermissions(instance, sharedPermission => {
          if (sharedPermission.type === 'projectRole') {
            sharedPermission.type = 'project'
          }
        }),
      ),
})

export default filter
