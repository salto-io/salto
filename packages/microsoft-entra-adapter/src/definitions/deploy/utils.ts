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

import { isAdditionChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import { validateArray, validatePlainObject } from '../type-validators'
import { AdjustFunction, DeployCustomDefinitions, DeployRequestDefinition, EndpointPath } from './types'
import { ROLE_DEFINITION_TYPE_NAME } from '../../constants'
import { TYPE_NAME_TO_READ_ONLY_FIELDS } from '../../change_validators'

export const createDefinitionForAppRoleAssignment = (
  parentResourceName: string,
  typeName: string,
): DeployCustomDefinitions => ({
  [typeName]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: `/${parentResourceName}/{parent_id}/appRoleAssignments` as EndpointPath,
                method: 'post',
              },
              transformation: {
                omit: ['id'],
                adjust: item => {
                  validatePlainObject(item.value, typeName)
                  if (!isAdditionChange(item.context.change)) {
                    throw new Error('Unexpected value, expected a plain object')
                  }
                  const parentId = _.get(item.context, 'additionalContext.parent_id')
                  if (parentId === undefined) {
                    throw new Error(`Missing parent_id in context, cannot add ${typeName} without a parent_id`)
                  }
                  return {
                    value: {
                      ...item.value,
                      principalId: parentId,
                    },
                  }
                },
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: `/${parentResourceName}/{parent_id}/appRoleAssignments/{id}` as EndpointPath,
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
})

// For some reason the fetch result doesn't return proper structure according to the docs
// https://learn.microsoft.com/en-us/graph/api/intune-rbac-roledefinition-list?view=graph-rest-1.0&tabs=http
// So we adjust the structure to match the docs
export const adjustRoleDefinitionForDeployment: AdjustFunction = ({ value }) => {
  validatePlainObject(value, ROLE_DEFINITION_TYPE_NAME)
  const rolePermissions = _.get(value, 'rolePermissions', [])
  validateArray(rolePermissions, 'rolePermissions')
  return {
    value: {
      ...value,
      rolePermissions: rolePermissions.map(rolePermission => {
        validatePlainObject(rolePermission, 'rolePermission')
        return {
          '@odata.type': 'microsoft.graph.rolePermission',
          resourceActions: [
            {
              '@odata.type': 'microsoft.graph.resourceAction',
              ...rolePermission,
            },
          ],
        }
      }),
    },
  }
}

export const omitReadOnlyFields: AdjustFunction = ({ typeName, value, context }) => {
  validatePlainObject(value, typeName)
  const readOnlyFieldsToOmit = TYPE_NAME_TO_READ_ONLY_FIELDS[typeName]
  if (readOnlyFieldsToOmit === undefined || context.action !== 'modify') {
    return { value }
  }
  return { value: _.omit(value, readOnlyFieldsToOmit) }
}

export const createCustomizationsWithBasePath = (
  customizations: DeployCustomDefinitions,
  basePath: string,
): DeployCustomDefinitions =>
  _.mapValues(customizations, customization => ({
    ...customization,
    requestsByAction: {
      ...customization.requestsByAction,
      customizations: {
        ..._.mapValues(customization.requestsByAction?.customizations, actionCustomizations =>
          (actionCustomizations ?? []).map(action => ({
            ...action,
            request: {
              ...action.request,
              ...((action.request.endpoint
                ? { endpoint: { ...action.request.endpoint, path: `${basePath}${action.request.endpoint.path}` } }
                : {}) as DeployRequestDefinition['endpoint']),
            },
          })),
        ),
      },
    },
  }))
