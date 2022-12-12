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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError, isAdditionOrModificationChange, isInstanceChange, ChangeValidator,
  InstanceElement, getChangeData,
} from '@salto-io/adapter-api'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType, buildSelectQueries, queryClient } from '../filters/utils'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable

// cf. 'Statement Character Limit' in https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select.htm
const SALESFORCE_MAX_QUERY_LEN = 100000

type UserGetterFunc = (instance: InstanceElement) => string | undefined

type FieldGetterDef = {
  field: string
  getter: UserGetterFunc
}

type UserGetterDef = {
  [type: string]: FieldGetterDef[]
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

const USER_GETTERS: UserGetterDef = {
  CaseSettings: [
    {
      field: 'defaultCaseUser',
      getter: instance => instance.value.defaultCaseUser,
    },
    {
      field: 'defaultCaseOwner',
      getter: instance => getCaseSettingsOwner(instance),
    },
  ],
}

const isValidUser = (user: string|undefined): user is string => !_.isUndefined(user)

const getUsersFromInstance = (instance: InstanceElement, getterDefs: FieldGetterDef[]): string[] => (
  getterDefs.map(getterDef => getterDef.getter(instance)).filter(isValidUser)
)

const getUsersFromInstances = async (
  defMapping: UserGetterDef,
  instances: InstanceElement[]): Promise<string[]> => (
  awu(instances).map(async instance => {
    const instanceType = await apiName(await instance.getType())
    const getterDefs = defMapping[instanceType]
    return getUsersFromInstance(instance, getterDefs)
  }).flat().toArray()
)

const getSalesforceUsers = async (client: SalesforceClient, users: string[]): Promise<string[]> => {
  if (users.length === 0) {
    return []
  }

  const queries = await buildSelectQueries('User', ['Username'], users.map(userName => ({ Username: userName })), SALESFORCE_MAX_QUERY_LEN)

  return awu(await queryClient(client, queries)).map(sfRecord => sfRecord.Username).toArray()
}

const getUnknownUsers = async (
  defMapping: UserGetterDef,
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
  const instancesOfInterest = await awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfType(...Object.keys(USER_GETTERS)))
    .toArray()

  const userRefs = await getUsersFromInstances(USER_GETTERS, instancesOfInterest)
  const existingUsers = await getSalesforceUsers(client, userRefs)

  return awu(instancesOfInterest)
    .flatMap(async elem => getUnknownUsers(USER_GETTERS, elem, existingUsers))
    .map(unknownUserError)
    .toArray()
}

export default changeValidator
