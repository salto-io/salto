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
import { BuiltinTypes, CORE_ANNOTATIONS, Field, getChangeElement, isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { role } from '../types/custom_types/role'
import NetsuiteClient from '../client/client'

const log = logger(module)

const getRolesScriptIdsToInternalIds = async (client: NetsuiteClient):
Promise<Record<string, string>> => {
  const rolesResults = await client.runSuiteQL('SELECT scriptid, id FROM role ORDER BY id ASC')
  if (rolesResults === undefined) {
    log.warn('Roles query failed')
    return {}
  }

  return Object.fromEntries(
    rolesResults
      .filter((res): res is { scriptid: string; id: string } => {
        if ([res.scriptid, res.id].some(val => typeof val !== 'string')) {
          log.warn('Got invalid result from roles query, %o', res)
          return false
        }
        return true
      })
      .map(res => ([res.scriptid, res.id]))
  )
}


const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async elements => {
    if (!client.isSuiteAppConfigured() || !elements.some(e => e.elemID.typeName === 'role')) {
      return
    }
    role.fields.internalId = new Field(
      role,
      'internalId',
      BuiltinTypes.STRING,
      { [CORE_ANNOTATIONS.HIDDEN_VALUE]: true },
    )

    const scriptIdToInternalId = await getRolesScriptIdsToInternalIds(client)

    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === 'role')
      .forEach(e => {
        e.value.internalId = scriptIdToInternalId[e.value.scriptid]
      })
  },

  preDeploy: async changes => {
    _(changes)
      .map(getChangeElement)
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === 'role')
      .forEach(element => {
        delete element.value.internalId
      })
  },

  onDeploy: async changes => {
    if (!client.isSuiteAppConfigured() || !changes.some(change => isAdditionChange(change) && getChangeElement(change).elemID.typeName === 'role')) {
      return
    }

    const scriptIdToInternalId = await getRolesScriptIdsToInternalIds(client)

    changes
      .filter(isAdditionChange)
      .map(getChangeElement)
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === 'role')
      .forEach(e => {
        e.value.internalId = scriptIdToInternalId[e.value.scriptid]
      })
  },
})

export default filterCreator
