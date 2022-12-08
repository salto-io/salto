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
import _, { Dictionary } from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError, isAdditionOrModificationChange, isInstanceChange, ChangeValidator,
  InstanceElement, getChangeData,
} from '@salto-io/adapter-api'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType } from '../filters/utils'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable

// cf. 'Statement Character Limit' in https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select.htm
const SALESFORCE_MAX_QUERY_LEN = 100000

type UserGetterFunc = (instance: InstanceElement) => string | undefined

type UserGetterDef = {
  type: string
  field: string
  getter: UserGetterFunc
}

type MissingUserInfo = {
  instance: InstanceElement
  field: string
  userName: string
}

const getCaseSettingsOwner = (instance: InstanceElement,): string | undefined => {
  if (instance.value.defaultCaseOwnerType !== 'User') {
    return undefined
  }
  return instance.value.defaultCaseOwner
}

const USER_GETTERS: UserGetterDef[] = [
  {
    type: 'CaseSettings',
    field: 'defaultCaseUser',
    getter: instance => instance.value.defaultCaseUser,
  },
  {
    type: 'CaseSettings',
    field: 'defaultCaseOwner',
    getter: instance => getCaseSettingsOwner(instance),
  },
]

const isValidUser = (user: string|undefined): user is string => !_.isUndefined(user)

const getUsersFromInstance = (instance: InstanceElement, getterDefs: UserGetterDef[]): string[] => (
  getterDefs.map(getterDef => getterDef.getter(instance)).filter(isValidUser)
)

const getUsersFromInstances = async (
  defMapping: Dictionary<UserGetterDef[]>,
  instances: InstanceElement[]): Promise<string[]> => (
  awu(instances).map(async instance => {
    const instanceType = await apiName(await instance.getType())
    const getterDefs = defMapping[instanceType]
    return getUsersFromInstance(instance, getterDefs)
  }).flat().toArray()
)

const getSalesforceUsers = async (client: SalesforceClient, users: string[]): Promise<string[]> => {
  const userWhereClause = (userName: string): string => `Username='${userName}'`

  const createQueryChunks = (): string[][] => {
    let chunkLen = 0
    let prevChunkIdx = 0
    let chunkIdx = 0
    const queryChunks: string[][] = []

    while (chunkIdx < users.length) {
      while (chunkLen < SALESFORCE_MAX_QUERY_LEN && chunkIdx < users.length) {
        chunkLen += 'OR '.length + userWhereClause(users[chunkIdx]).length
        chunkIdx += 1
      }
      queryChunks.push(users.slice(prevChunkIdx, chunkIdx))

      prevChunkIdx = chunkIdx
    }

    return queryChunks
  }

  if (users.length === 0) {
    return []
  }
  const userChunks = createQueryChunks()

  return awu(userChunks).map(async usersChunk => {
    const queryStr = `SELECT Username FROM User WHERE ${usersChunk.map(userWhereClause).join('OR ')}`
    const queryResult = await client.queryAll(queryStr)
    return awu(queryResult).flat().map(sfRecord => sfRecord.Username)
  }).flat().toArray()
}

const getUnknownUsers = async (
  defMapping: Dictionary<UserGetterDef[]>,
  instance: InstanceElement,
  existingUsers: string[],
): Promise<MissingUserInfo[]> => {
  const instanceType = await apiName(await instance.getType())
  const getterDefs = defMapping[instanceType]

  return (getterDefs
    .map(getterDef => ({ instance, field: getterDef.field, userName: getterDef.getter(instance) }))
    .filter(missingUserInfo => isValidUser(missingUserInfo.userName)) as MissingUserInfo[])
    .filter(missingUserInfo => !existingUsers.includes(missingUserInfo.userName))
}

const unknownUserError = ({ instance, field, userName }: MissingUserInfo): ChangeError => (
  {
    elemID: instance.elemID,
    severity: 'Error',
    message: `The field ${field} in '${instance.elemID.getFullName()}' refers to the user '${userName}' which does not exist in this Salesforce environment`,
    detailedMessage: `The field ${field} in '${instance.elemID.getFullName()}' refers to the user '${userName}' which does not exist in this Salesforce environment`,
  }
)

/**
 * Fields that reference users may refer to users that don't exist. The most common case would be when deploying
 * between different environment, as users by definition can't exist in multiple environments.
 */
const changeValidator = (client: SalesforceClient): ChangeValidator => async changes => {
  const gettersMap = _.groupBy(USER_GETTERS, 'type')
  const typesOfInterest = USER_GETTERS.map(userGetter => userGetter.type)
  const instancesOfInterest = await awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfType(...typesOfInterest))
    .toArray()

  const userRefs = await getUsersFromInstances(gettersMap, instancesOfInterest)
  const existingUsers = await getSalesforceUsers(client, userRefs)

  return awu(instancesOfInterest)
    .map(async elem => getUnknownUsers(gettersMap, elem, existingUsers))
    .flat()
    .map(unknownUserError)
    .toArray()
}

export default changeValidator
