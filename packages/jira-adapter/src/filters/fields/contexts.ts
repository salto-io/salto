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
import { AdditionChange, Change, getChangeData, InstanceElement, isAdditionChange, isMapType, isModificationChange, isObjectType, ModificationChange, ObjectType, toChange, Value, Values } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { config } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { defaultDeployChange } from '../../deployment'
import JiraClient from '../../client/client'
import { setContextOptions, setOptionTypeDeploymentAnnotations } from './context_options'
import { setDefaultValueTypeDeploymentAnnotations } from './default_values'
import { setContextField } from './issues_and_projects'
import { setDeploymentAnnotations } from './utils'

const { awu } = collections.asynciterable

const FIELDS_TO_IGNORE = ['defaultValue', 'options']

const log = logger(module)

const toContextInstance = (
  context: Values,
  contextType: ObjectType,
): InstanceElement =>
  new InstanceElement(context.id, contextType, context)

const getContextChanges = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  contextType: ObjectType
): Change<InstanceElement>[] => {
  const instance = getChangeData(change)
  if (isAdditionChange(change)) {
    return Object.values(instance.value.contexts ?? {}).map(
      (context: Value) => toChange({
        after: toContextInstance(context, contextType),
      })
    )
  }

  const afterContexts = _.values(change.data.after.value.contexts ?? {})
  const beforeContexts = _.values(change.data.before.value.contexts ?? {})
  const afterContextsById = _.keyBy(afterContexts, context => context.id)
  const beforeContextsById = _.keyBy(beforeContexts, context => context.id)

  const removeChanges = beforeContexts
    .filter(context => !(context.id in afterContextsById))
    .map(context => toChange({
      before: toContextInstance(context, contextType),
    }))

  const addedChanges = afterContexts
    .filter(context => !(context.id in beforeContextsById))
    .map(context => toChange({
      after: toContextInstance(context, contextType),
    }))

  const modifiedChanges = afterContexts
    .filter(context => context.id in beforeContextsById)
    .map(context => toChange({
      before: toContextInstance(beforeContextsById[context.id], contextType),
      after: toContextInstance(context, contextType),
    }))

  return [...removeChanges, ...modifiedChanges, ...addedChanges]
}


const getContextType = async (fieldType: ObjectType):
Promise<ObjectType> => {
  const contextMapType = await fieldType.fields.contexts.getType()
  if (!isMapType(contextMapType)) {
    throw new Error(`type of ${fieldType.fields.contexts.elemID.getFullName()} is not a map type`)
  }

  const contextType = await contextMapType.getInnerType()
  if (!isObjectType(contextType)) {
    throw new Error(`inner type of ${fieldType.fields.contexts.elemID.getFullName()} is not an object type`)
  }

  return contextType
}

const deployContextChange = async (
  change: Change<InstanceElement>,
  parentField: InstanceElement,
  client: JiraClient,
  apiDefinitions: config.AdapterApiConfig,
): Promise<void> => {
  await defaultDeployChange({
    change,
    client,
    apiDefinitions,
    // 'issueTypeIds', 'projectIds' can be deployed in the same endpoint as create
    // but for modify there are different endpoints for them
    fieldsToIgnore: isAdditionChange(change) ? FIELDS_TO_IGNORE : [...FIELDS_TO_IGNORE, 'issueTypeIds', 'projectIds'],
    additionalUrlVars: { fieldId: parentField.value.id },
  })

  await setContextField(change, 'issueTypeIds', 'issuetype', parentField, client)
  await setContextField(change, 'projectIds', 'project', parentField, client)
  await setContextOptions(change, parentField, client)
}

const getContexts = async (
  fieldChange: AdditionChange<InstanceElement>,
  contextType: ObjectType,
  client: JiraClient,
): Promise<InstanceElement[]> => {
  const fieldInstance = getChangeData(fieldChange)
  const resp = await client.getSinglePage({ url: `/rest/api/3/field/${fieldInstance.value.id}/contexts` })
  if (!Array.isArray(resp.data.values)) {
    log.warn(`Received unexpected response from Jira when querying contexts for instance ${getChangeData(fieldChange).elemID.getFullName()}: ${safeJsonStringify(resp.data.values)}`)
    throw new Error(`Received unexpected response from Jira when querying contexts for instance ${getChangeData(fieldChange).elemID.getFullName()}`)
  }
  return resp.data.values.map(values => new InstanceElement(values.id, contextType, values))
}

export const deployContexts = async (
  fieldChange: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  client: JiraClient,
  apiDefinitions: config.AdapterApiConfig,
): Promise<void> => {
  const contextType = await getContextType(await getChangeData(fieldChange).getType())
  // When creating a field, it is created with a default context,
  // in addition to what is in the NaCl so we need to delete it
  const removalContextsChanges = isAdditionChange(fieldChange)
    ? (await getContexts(fieldChange, contextType, client))
      .map(instance => toChange({ before: instance }))
    : []

  const fieldInstance = getChangeData(fieldChange)

  const contextChanges = [
    ...removalContextsChanges,
    ...getContextChanges(fieldChange, contextType),
  ]
  await awu(contextChanges).filter(contextChange => (
    !isModificationChange(contextChange)
    || !contextChange.data.before.isEqual(contextChange.data.after)
  )).forEach(async contextChange => {
    await deployContextChange(contextChange, fieldInstance, client, apiDefinitions)
  })
}


export const setContextDeploymentAnnotations = async (
  fieldType: ObjectType,
): Promise<void> => {
  setDeploymentAnnotations(fieldType, 'contexts')
  const contextType = await getContextType(fieldType)

  await setDefaultValueTypeDeploymentAnnotations(contextType)
  setDeploymentAnnotations(contextType, 'projectIds')
  setDeploymentAnnotations(contextType, 'issueTypeIds')
  await setOptionTypeDeploymentAnnotations(contextType)
}
