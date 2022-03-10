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
import { AdditionChange, Change, getChangeData, getDeepInnerType, InstanceElement, isAdditionChange, isObjectType, isRemovalChange, ModificationChange, toChange, Values } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { resolveValues } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { JiraConfig } from '../../config'
import JiraClient from '../../client/client'
import { deployWithJspEndpoints } from '../../deployment/jsp_deployment'
import { LEVEL_MEMBER_TYPE_NAME } from '../../constants'
import { getLookUpName } from '../../reference_mapping'

const log = logger(module)

export const getMemberKey = (member: Values): string =>
  `${member.holder.type}-${member.holder.parameter}`

const CUSTOM_MEMBER_TYPES: Record<string, string> = {
  userCustomField: 'userCF',
  groupCustomField: 'groupCF',
  projectLead: 'lead',
  projectRole: 'projectrole',
}

const getMemberRequestValues = (member: Values, securityLevel: InstanceElement): Values => {
  const { holder: { type, parameter } } = member

  const requestType = CUSTOM_MEMBER_TYPES[type] ?? type

  return _.pickBy({
    schemeId: securityLevel.value.schemeId,
    security: securityLevel.value.id,
    type: requestType,
    [requestType]: parameter?.toString(),
  }, values.isDefined)
}

const getMemberChanges = async (
  securityLevelChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
): Promise<Change<InstanceElement>[]> => {
  const instance = await resolveValues(getChangeData(securityLevelChange), getLookUpName)

  const memberType = await getDeepInnerType(
    await (await instance.getType()).fields.members.getType()
  )

  if (!isObjectType(memberType)) {
    throw new Error('Members field type in security level type is not an object type')
  }

  const keyToMember = _.keyBy(instance.value.members, getMemberKey)

  const removedIds = _(instance.value.memberIds)
    .pickBy((_id, key) => keyToMember[key] === undefined)
    .entries()
    .map(([key, id]) => ({ key, id }))
    .value()

  const addedMembers = _(keyToMember)
    .pickBy((_member, key) => instance.value.memberIds?.[key] === undefined)
    .values()
    .value()

  const removalChanges = removedIds.map(({ key, id }) => toChange({
    before: new InstanceElement(
      key,
      memberType,
      {
        id,
        schemeId: instance.value.schemeId,
        name: key,
      }
    ),
  }))

  const additionalChanges = addedMembers.map(member => toChange({
    after: new InstanceElement(
      getMemberKey(member),
      memberType,
      {
        ...getMemberRequestValues(member, instance),
        name: getMemberKey(member),
      }
    ),
  }))

  return [...removalChanges, ...additionalChanges]
}

export const deployMembers = async (
  securityLevelChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  config: JiraConfig,
  client: JiraClient,
): Promise<void> => {
  const jspRequests = config.apiDefinitions.types[LEVEL_MEMBER_TYPE_NAME]?.jspRequests
  if (jspRequests === undefined) {
    throw new Error(`${LEVEL_MEMBER_TYPE_NAME} jsp urls are missing from the configuration`)
  }

  const urls = {
    ...jspRequests,
    query: elementUtils.replaceUrlParams(
      jspRequests.query,
      {
        id: getChangeData(securityLevelChange).value.schemeId,
      }
    ),
  }

  const memberChanges = await getMemberChanges(securityLevelChange)

  const res = await deployWithJspEndpoints({
    changes: memberChanges,
    client,
    urls,
    getNameFunction: getMemberKey,
    serviceValuesTransformer: serviceValues => ({
      ...serviceValues,
      ...getMemberRequestValues(serviceValues, getChangeData(securityLevelChange)),
    }),
  })

  const securityLevelInstance = getChangeData(securityLevelChange)

  memberChanges.forEach(change => {
    const memberInstance = getChangeData(change)
    if (isRemovalChange(change)) {
      delete securityLevelInstance.value.memberIds[memberInstance.value.name]
    }

    if (isAdditionChange(change)) {
      if (securityLevelInstance.value.memberIds === undefined) {
        securityLevelInstance.value.memberIds = {}
      }
      securityLevelInstance.value.memberIds[memberInstance.value.name] = memberInstance.value.id
    }
  })

  if (res.errors.length !== 0) {
    log.error(`Failed to deploy security level members of ${securityLevelInstance.elemID.getFullName()}: ${res.errors.join(', ')}`)
    throw new Error(`Failed to deploy security level members of ${securityLevelInstance.elemID.getFullName()}`)
  }
}
