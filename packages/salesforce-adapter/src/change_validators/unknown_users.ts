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
  ChangeError,
  isAdditionOrModificationChange,
  isInstanceChange,
  ChangeValidator,
  InstanceElement,
  getChangeData,
  Values,
  Value,
  ElemID,
} from '@salto-io/adapter-api'
import {
  transformElement,
  TransformFuncArgs,
} from '@salto-io/adapter-utils'
import _ from 'lodash'
import { buildSelectQueries, queryClient } from '../filters/utils'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

// cf. 'Statement Character Limit' in https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select.htm
const SALESFORCE_MAX_QUERY_LEN = 100000

type GetUserField = (container: Values, fieldName: string) => string[]

type UserFieldGetter = {
  field: string
  getter: (container: Values) => string[]
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
  'PresenceConfigAssignments',
  'Users',
] as const
type TypeWithUserFields = typeof TYPES_WITH_USER_FIELDS[number]

type TypesWithUserFields = Record<TypeWithUserFields, UserFieldGetter[]>

type UserRef = {
  elemId: ElemID
  field: string
  user: string
}

const userFieldValue = (container: Values, fieldName: string): string[] => makeArray(container?.[fieldName])

const getUserDependingOnType = (typeField: string): GetUserField => (
  (container: Values, userField: string) => {
    const type = container[typeField]
    if (!type || type.toLocaleLowerCase() !== 'user') {
      return []
    }
    return [container[userField]]
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

const getEmailRecipients: GetUserField = ({ recipients }) => {
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
    getter: (container: Values) => userFieldGetter(container, fieldName),
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
  PresenceConfigAssignments: [
    userField('user', userFieldValue),
  ],
  Users: [
    userField('user', userFieldValue),
  ],
}

const userFieldGettersForType = (defMapping: TypesWithUserFields, type: string): UserFieldGetter[] => {
  const instanceTypeAsTypeWithUserFields = (): TypeWithUserFields | undefined => (
    TYPES_WITH_USER_FIELDS.find(t => t === type)
  )

  const instanceType = instanceTypeAsTypeWithUserFields()
  return instanceType ? defMapping[instanceType] : []
}

const getUsersFromInstance = async (instance: InstanceElement, getterDefs: TypesWithUserFields): Promise<UserRef[]> => {
  const users: UserRef[] = []

  const extractUsers = async ({ value, path, field }: TransformFuncArgs): Promise<Value> => {
    const type = (field === undefined) ? instance.elemID.typeName : (await field.getType()).elemID.typeName
    if (path && value && Object.keys(getterDefs).includes(type)) {
      const getters = userFieldGettersForType(getterDefs, type)
      const userRefs: UserRef[] = getters
        .flatMap(getterDef => (
          getterDef.getter(value)
            .map(user => ({ user, elemId: path, field: getterDef.field }))
        ))
      users.push(...userRefs)
    }
    return value
  }

  await transformElement({
    element: instance,
    transformFunc: extractUsers,
  })
  return users
}

const getUsersFromInstances = async (
  defMapping: TypesWithUserFields,
  instances: InstanceElement[]): Promise<UserRef[]> => (
  awu(instances)
    .map(async instance => getUsersFromInstance(instance, defMapping))
    .flat()
    .toArray()
)

const getSalesforceUsers = async (client: SalesforceClient, users: string[]): Promise<string[]> => {
  if (users.length === 0) {
    return []
  }

  const queries = await buildSelectQueries('User', ['Username'], users.map(userName => ({ Username: `'${userName}'` })), SALESFORCE_MAX_QUERY_LEN)

  return awu(await queryClient(client, queries)).map(sfRecord => sfRecord.Username).toArray()
}

const unknownUserError = ({ elemId, field, user }: UserRef): ChangeError => (
  {
    elemID: elemId,
    severity: 'Error',
    message: `User ${user} doesn't exist`,
    detailedMessage: `The field ${field} in '${elemId.getFullName()}' refers to the user '${user}' which does not exist in this Salesforce environment`,
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
    .toArray()

  const userRefs = await getUsersFromInstances(USER_GETTERS, instancesOfInterest)
  const existingUsers = new Set(await getSalesforceUsers(client, userRefs.map(({ user }) => user)))

  return userRefs
    .filter(({ user }) => !existingUsers.has(user))
    .map(unknownUserError)
}

export default changeValidator
