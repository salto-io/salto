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
import { transformElement, TransformFuncArgs } from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  buildSelectQueries,
  isInstanceOfType,
  queryClient,
} from '../filters/utils'
import SalesforceClient from '../client/client'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

type GetUserField = (container: Values, fieldName: string) => string[]

type UserFieldGetter = {
  subType: string | undefined
  field: string
  getter: (container: Values) => string[]
}

// https://stackoverflow.com/a/44154193
const TYPES_WITH_USER_FIELDS = [
  'CaseSettings',
  'EscalationRules',
  'FolderShare',
  'WorkflowAlert',
  'WorkflowTask',
  'WorkflowOutboundMessage',
  'AssignmentRules',
  'ApprovalProcess',
  'CustomSite',
  'EmailServicesFunction',
  'PresenceUserConfig',
  'Queue',
] as const
type TypeWithUserFields = (typeof TYPES_WITH_USER_FIELDS)[number]

type TypesWithUserFields = Record<TypeWithUserFields, UserFieldGetter[]>

type UserRef = {
  elemId: ElemID
  field: string
  user: string
}

const userFieldValue = (container: Values, fieldName: string): string[] =>
  makeArray(container?.[fieldName])

const getUserDependingOnType =
  (typeField: string): GetUserField =>
  (container: Values, userField: string) => {
    const type = container[typeField]
    if (!type || type.toLocaleLowerCase() !== 'user') {
      return []
    }
    return [container[userField]]
  }

type EmailRecipientValue = {
  type: string
  recipient: string
}

const isEmailRecipientsValue = (
  recipients: Values,
): recipients is EmailRecipientValue[] =>
  _.isArray(recipients) &&
  recipients.every(
    (recipient) =>
      _.isString(recipient.type) && _.isString(recipient.recipient),
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
): UserFieldGetter => ({
  subType: undefined,
  field: fieldName,
  getter: (container: Values) => userFieldGetter(container, fieldName),
})

const userNestedField = (
  subType: string,
  fieldName: string,
  userFieldGetter: GetUserField,
): UserFieldGetter => ({
  subType,
  field: fieldName,
  getter: (container: Values) => userFieldGetter(container, fieldName),
})

const USER_GETTERS: TypesWithUserFields = {
  CaseSettings: [
    userField('defaultCaseUser', userFieldValue),
    userField(
      'defaultCaseOwner',
      getUserDependingOnType('defaultCaseOwnerType'),
    ),
  ],
  FolderShare: [userField('sharedTo', getUserDependingOnType('sharedToType'))],
  WorkflowAlert: [userField('recipients', getEmailRecipients)],
  WorkflowTask: [
    userField('assignedTo', getUserDependingOnType('assignedToType')),
  ],
  WorkflowOutboundMessage: [userField('integrationUser', userFieldValue)],
  AssignmentRules: [
    userNestedField(
      'RuleEntry',
      'assignedTo',
      getUserDependingOnType('assignedToType'),
    ),
  ],
  ApprovalProcess: [
    userNestedField('Approver', 'name', getUserDependingOnType('type')),
  ],
  CustomSite: [
    userField('siteAdmin', userFieldValue),
    userField('siteGuestRecordDefaultOwner', userFieldValue),
  ],
  EmailServicesFunction: [
    userNestedField('EmailServicesAddress', 'runAsUser', userFieldValue),
  ],
  PresenceUserConfig: [
    userNestedField('PresenceConfigAssignments', 'user', userFieldValue),
  ],
  Queue: [userNestedField('Users', 'user', userFieldValue)],
  EscalationRules: [
    userNestedField(
      'EscalationAction',
      'assignedTo',
      getUserDependingOnType('assignedToType'),
    ),
  ],
}

const userFieldGettersForType = (
  defMapping: TypesWithUserFields,
  type: string,
): UserFieldGetter[] => {
  const instanceTypeAsTypeWithUserFields = (): TypeWithUserFields | undefined =>
    TYPES_WITH_USER_FIELDS.find((t) => t === type)

  const instanceType = instanceTypeAsTypeWithUserFields()
  return instanceType ? defMapping[instanceType] : []
}

const getUsersFromInstance = async (
  instance: InstanceElement,
  getterDefs: TypesWithUserFields,
): Promise<UserRef[]> => {
  const gettersForInstanceType = userFieldGettersForType(
    getterDefs,
    (await instance.getType()).elemID.typeName,
  )

  const [topLevelGetters, nestedGetters] = _.partition(
    gettersForInstanceType,
    (g) => g.subType === undefined,
  )

  const users: UserRef[] = topLevelGetters.flatMap((getter) =>
    getter
      .getter(instance.value)
      .map((user) => ({ user, elemId: instance.elemID, field: getter.field })),
  )

  const gettersBySubType = new Map(
    nestedGetters.map((getter) => [getter.subType, getter]),
  )
  const extractUsers = async ({
    value,
    path,
    field,
  }: TransformFuncArgs): Promise<Value> => {
    const subType = (await field?.getType())?.elemID.typeName
    const subTypeGetter = gettersBySubType.get(subType)
    if (subTypeGetter && path) {
      const userRefs = subTypeGetter
        .getter(value)
        .map((user) => ({ user, elemId: path, field: subTypeGetter.field }))
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
  instances: InstanceElement[],
): Promise<UserRef[]> =>
  awu(instances)
    .map(async (instance) => getUsersFromInstance(instance, defMapping))
    .flat()
    .toArray()

const getSalesforceUsers = async (
  client: SalesforceClient,
  users: string[],
): Promise<string[]> => {
  if (users.length === 0) {
    return []
  }

  const queries = buildSelectQueries(
    'User',
    ['Username'],
    users.map((userName) => [
      { fieldName: 'Username', operator: 'IN', value: `'${userName}'` },
    ]),
  )

  return awu(await queryClient(client, queries))
    .map((sfRecord) => sfRecord.Username)
    .toArray()
}

const unknownUserError = ({ elemId, field, user }: UserRef): ChangeError => ({
  elemID: elemId,
  severity: 'Error',
  message: 'User does not exist',
  detailedMessage: `The field ${field} in '${elemId.getFullName()}' refers to the user '${user}' which does not exist in this Salesforce environment`,
})

/**
 * Fields that reference users may refer to users that don't exist. The most common case would be when deploying
 * between different environment, as users by definition can't exist in multiple environments.
 */
const changeValidator =
  (client: SalesforceClient): ChangeValidator =>
  async (changes) => {
    const instancesOfInterest = await awu(changes)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .map(getChangeData)
      .filter(isInstanceOfType(...Object.keys(USER_GETTERS)))
      .toArray()

    const userRefs = await getUsersFromInstances(
      USER_GETTERS,
      instancesOfInterest,
    )
    const existingUsers = new Set(
      await getSalesforceUsers(
        client,
        userRefs.map(({ user }) => user),
      ),
    )

    return userRefs
      .filter(({ user }) => !existingUsers.has(user))
      .map(unknownUserError)
  }

export default changeValidator
