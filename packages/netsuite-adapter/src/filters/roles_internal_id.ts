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
import { BuiltinTypes, Change, CORE_ANNOTATIONS, Field, getChangeElement, InstanceElement, isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { role } from '../types/custom_types/role'
import NetsuiteClient from '../client/client'
import { ROLE } from '../constants'

const log = logger(module)

const isRoleResultValid = (result: Record<string, unknown>):
result is { scriptid: string; id: string } => {
  if ([result.scriptid, result.id].some(val => typeof val !== 'string')) {
    log.warn('Got invalid result from roles query, %o', result)
    return false
  }
  return true
}

const isRoleInstance = (element: unknown): element is InstanceElement =>
  isInstanceElement(element) && element.elemID.typeName === ROLE

const getRolesScriptIdsToInternalIds = async (client: NetsuiteClient):
Promise<Record<string, string>> => {
  const rolesResults = await client.runSuiteQL('SELECT scriptid, id FROM role ORDER BY id ASC')
  if (rolesResults === undefined) {
    log.warn('Roles query failed')
    return {}
  }

  return Object.fromEntries(
    rolesResults
      .filter(isRoleResultValid)
      .map(res => ([res.scriptid, res.id]))
  )
}

const getRoleAdditionInstances = (changes: Change[]): InstanceElement[] =>
  changes
    .filter(isAdditionChange)
    .map(getChangeElement)
    .filter(isRoleInstance)

/**
 * This filter adds the internal id to role instances
 * so we will be able to reference them in instances
 * that are returned from SOAP API (e.g., Employee)
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async elements => {
    role.fields.internalId = new Field(
      role,
      'internalId',
      BuiltinTypes.STRING,
      { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    )

    if (!client.isSuiteAppConfigured()
    || !elements.some(isRoleInstance)) {
      return
    }

    const scriptIdToInternalId = await getRolesScriptIdsToInternalIds(client)

    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ROLE)
      .forEach(e => {
        e.value.internalId = scriptIdToInternalId[e.value.scriptid]
      })
  },

  /**
   * This removes the internal id before deploy since we don't want to actually deploy it to SDF
   */
  preDeploy: async changes => {
    changes
      .map(getChangeElement)
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ROLE)
      .forEach(element => {
        delete element.value.internalId
      })
  },

  /**
   * This assign the internal id for new role instances created through Salto
   */
  onDeploy: async changes => {
    const roleAdditionInstances = getRoleAdditionInstances(changes)

    if (!client.isSuiteAppConfigured() || roleAdditionInstances.length === 0) {
      return
    }

    const scriptIdToInternalId = await getRolesScriptIdsToInternalIds(client)

    roleAdditionInstances
      .forEach(e => {
        e.value.internalId = scriptIdToInternalId[e.value.scriptid]
      })
  },
})

export default filterCreator
