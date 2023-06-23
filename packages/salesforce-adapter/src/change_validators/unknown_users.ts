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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeError, isAdditionOrModificationChange, isInstanceChange, ChangeValidator,
  InstanceElement, getChangeData, Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType, buildSelectQueries, queryClient } from '../filters/utils'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable

// cf. 'Statement Character Limit' in https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select.htm
const SALESFORCE_MAX_QUERY_LEN = 100000

type GetUserField = (instance: InstanceElement, fieldName: string) => string[]

type UserFieldGetter = {
  field: string
  getter: (instance: InstanceElement) => string[]
}

// https://stackoverflow.com/a/44154193
const TYPES_WITH_USER_FIELDS = [
  'CaseSettings',
  'FolderShare',
  'WorkflowAlert',
  'WorkflowTask',
  'WorkflowOutboundMessage',
  'RuleEntry',
  'Approver',
  'CustomSite',
  'EmailServicesAddress',
  'PresenceConfigUserAssignments',
  'Users',
] as const
type TypeWithUserFields = typeof TYPES_WITH_USER_FIELDS[number]

type TypesWithUserFields = Record<TypeWithUserFields, UserFieldGetter[]>

type MissingUser = {
  instance: InstanceElement
  field: string
  userName: string
}

const userFieldValue = (instance: InstanceElement, fieldName: string): string[] => {
  if (instance.value[fieldName] === undefined) {
    return []
  }
  return [instance.value[fieldName]]
}

const getUserDependingOnType = (typeField: string): GetUserField => (
  (instance: InstanceElement, userField: string) => {
    const type = instance.value[typeField]
    if (!type || type.toLocaleLowerCase() !== 'user') {
      return []
    }
    return [instance.value[userField]]
  }
)

type EmailRecipientValue = {
  type: string
  recipient: string
}

const isEmailRecipientsValue = (recipients: Values): recipients is EmailRecipientValue[] => (
  _.isArray(recipients)
  && recipients.every(recipient => _.isString(recipient.type) && _.isString(recipient.recipient))
)

const getEmailRecipients: GetUserField = instance => {
  const { recipients } = instance.value
  if (!isEmailRecipientsValue(recipients)) {
    return []
  }
  return recipients
    .filter((recipient: Values) => recipient.type === 'user')
    .map((recipient: Values) => recipient.recipient)
}

const userField = (
  fieldName: string,
  userFieldGetter: GetUserField,
): UserFieldGetter => (
  {
    field: fieldName,
    getter: (instance: InstanceElement) => userFieldGetter(instance, fieldName),
  }
)

const USER_GETTERS: TypesWithUserFields = {
  CaseSettings: [
    userField('defaultCaseUser', userFieldValue),
    userField('defaultCaseOwner', getUserDependingOnType('defaultCaseOwnerType')),
  ],
  FolderShare: [
    userField('sharedTo', getUserDependingOnType('sharedToType')),
  ],
  WorkflowAlert: [
    userField('recipients', getEmailRecipients),
  ],
  WorkflowTask: [
    userField('assignedTo', getUserDependingOnType('assignedToType')),
  ],
  WorkflowOutboundMessage: [
    userField('integrationUser', userFieldValue),
  ],
  RuleEntry: [
    userField('assignedTo', getUserDependingOnType('assignedToType')),
  ],
  Approver: [
    userField('name', getUserDependingOnType('type')),
  ],
  CustomSite: [
    userField('siteAdmin', userFieldValue),
    userField('siteGuestRecordDefaultOwner', userFieldValue),
  ],
  EmailServicesAddress: [
    userField('runAsUser', userFieldValue),
  ],
  PresenceConfigUserAssignments: [
    userField('user', userFieldValue),
  ],
  Users: [
    userField('user', userFieldValue),
  ],
}

const userFieldGettersForInstance = async (defMapping: TypesWithUserFields, instance: InstanceElement)
    : Promise<UserFieldGetter[]> => {
  const instanceTypeAsTypeWithUserFields = async (): Promise<TypeWithUserFields | undefined> => {
    const typeAsString = await apiName(await instance.getType())
    return TYPES_WITH_USER_FIELDS.find(t => t === typeAsString)
  }

  const instanceType = await instanceTypeAsTypeWithUserFields()
  return instanceType ? defMapping[instanceType] : []
}

const getUsersFromInstance = (instance: InstanceElement, getterDefs: UserFieldGetter[]): string[] => (
  getterDefs.flatMap(getterDef => getterDef.getter(instance))
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

  const queries = await buildSelectQueries('User', ['Username'], users.map(userName => ({ Username: `'${userName}'` })), SALESFORCE_MAX_QUERY_LEN)

  return awu(await queryClient(client, queries)).map(sfRecord => sfRecord.Username).toArray()
}

const getUnknownUsers = async (
  defMapping: TypesWithUserFields,
  instanceElement: InstanceElement,
  knownUsers: string[],
): Promise<MissingUser[]> => {
  const extractUserInfo = (instance: InstanceElement, userFieldGetter: UserFieldGetter): MissingUser[] => {
    const userNames = userFieldGetter.getter(instance)

    return userNames.map(userName => ({
      instance,
      field: userFieldGetter.field,
      userName,
    }))
  }

  const getterDefs = await userFieldGettersForInstance(defMapping, instanceElement)

  return (getterDefs
    .flatMap(getterDef => extractUserInfo(instanceElement, getterDef))
    .filter(missingUserInfo => !knownUsers.includes(missingUserInfo.userName)))
}

const unknownUserError = ({ instance, field, userName }: MissingUser): ChangeError => (
  {
    elemID: instance.elemID,
    severity: 'Error',
    message: `User ${userName} doesn't exist`,
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
