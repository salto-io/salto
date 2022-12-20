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
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  ChangeError, isAdditionOrModificationChange, isInstanceChange, ChangeValidator,
  InstanceElement, getChangeData,
} from '@salto-io/adapter-api'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType, buildSelectQueries, queryClient } from '../filters/utils'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable
const log = logger(module)

// cf. 'Statement Character Limit' in https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select.htm
const SALESFORCE_MAX_QUERY_LEN = 100000

type GetUserField = (instance: InstanceElement, fieldName: string) => string | undefined

type UserFieldGetter = {
  field: string
  getter: GetUserField
}

// https://stackoverflow.com/a/44154193
const TypesWithUserFields = {
  CaseSettings: 'CaseSettings',
} as const
type TypeWithUserFields = keyof typeof TypesWithUserFields


type TypesWithUserFields = Record<TypeWithUserFields, UserFieldGetter[]>;

type MissingUser = {
  instance: InstanceElement
  field: string
  userName: string
}

const getCaseSettingsOwner = (instance: InstanceElement, fieldName: string): string | undefined => {
  if (fieldName !== 'defaultCaseOwner') {
    log.error(`Unexpected field name: ${fieldName}.`)
    return undefined
  }
  if (instance.value.defaultCaseOwnerType !== 'User') {
    log.debug('defaultCaseOwnerType is not User. Skipping.')
    return undefined
  }
  return instance.value.defaultCaseOwner
}

const userFieldValue = (expectedFieldName: string): GetUserField => (
  (instance, fieldName) => {
    if (fieldName !== expectedFieldName) {
      log.error(`Unexpected field name: ${fieldName} !== ${expectedFieldName}`)
      return undefined
    }
    return instance.value[fieldName]
  }
)

const USER_GETTERS: TypesWithUserFields = {
  CaseSettings: [
    {
      field: 'defaultCaseUser',
      getter: userFieldValue('defaultCaseUser'),
    },
    {
      field: 'defaultCaseOwner',
      getter: (instance, fieldName) => getCaseSettingsOwner(instance, fieldName),
    },
  ],
}

const userFieldGettersForInstance = async (defMapping: TypesWithUserFields, instance: InstanceElement)
    : Promise<UserFieldGetter[]> => {
  const instanceTypeAsTypeWithUserFields = async (): Promise<TypeWithUserFields | undefined> => {
    const typeAsString = await apiName(await instance.getType())
    return Object.values(TypesWithUserFields).find(t => t === typeAsString)
  }

  const instanceType = await instanceTypeAsTypeWithUserFields()
  return instanceType ? defMapping[instanceType] : []
}

const isValidUser = (user: string|undefined): user is string => !!user

const getUsersFromInstance = (instance: InstanceElement, getterDefs: UserFieldGetter[]): string[] => (
  getterDefs.map(getterDef => getterDef.getter(instance, getterDef.field)).filter(isValidUser)
)

const getUsersFromInstances = async (
  defMapping: TypesWithUserFields,
  instances: InstanceElement[]): Promise<string[]> => (
  awu(instances).map(async instance => {
    const getterDefs = await userFieldGettersForInstance(defMapping, instance)
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
  defMapping: TypesWithUserFields,
  instance: InstanceElement,
  knownUsers: string[],
): Promise<MissingUser[]> => {
  const getterDefs = await userFieldGettersForInstance(defMapping, instance)

  return (getterDefs
    .map(getterDef => ({ instance, field: getterDef.field, userName: getterDef.getter(instance, getterDef.field) }))
    .filter(missingUserInfo => isValidUser(missingUserInfo.userName)) as MissingUser[])
    .filter(missingUserInfo => !knownUsers.includes(missingUserInfo.userName))
}

const unknownUserError = ({ instance, field, userName }: MissingUser): ChangeError => (
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
