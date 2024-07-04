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
import {
  Element,
  InstanceElement,
  SaltoElementError,
  createSaltoElementError,
  getChangeData,
  isInstanceChange,
  isRemovalChange,
  isModificationChange,
  isReferenceExpression,
  Change,
  toChange,
  Values,
  ReferenceExpression,
  DeployResult,
  isModificationChange,
  isReferenceExpression,
  Change,
  toChange,
  Values,
  ReferenceExpression,
  DeployResult,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { createSchemeGuard, getParent, hasValidParent } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { FilterCreator } from '../../filter'
import { deployContextChange, setContextDeploymentAnnotations } from './contexts'
import { deployChanges } from '../../deployment/standard_deployment'
import {
  FIELD_CONTEXT_OPTION_TYPE_NAME,
  FIELD_CONTEXT_TYPE_NAME,
  FIELD_TYPE_NAME,
  IS_LOCKED,
  SERVICE,
} from './constants'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'
import { isRelatedToSpecifiedTerms } from '../../change_validators/locked_fields'
import JiraClient from '../../client/client'
import { CONTEXT_NAME_FIELD } from './field_context_option_split'

const log = logger(module)

type ContextParams = {
  id: string
  name: string
}

type ContextGetResponse = {
  values: ContextParams[]
}

type BeforeOrAfter = 'before' | 'after'

const CONTEXT_RESOPNSE_SCHEME = Joi.object({
  values: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
      }).unknown(true),
    )
    .required(),
})
  .unknown(true)
  .required()

const isContextFieldResponse = createSchemeGuard<ContextGetResponse>(CONTEXT_RESOPNSE_SCHEME)

const deployJsmContextField = async (
  change: AdditionChange<InstanceElement>,
  parent: InstanceElement,
  client: JiraClient,
): Promise<SaltoElementError[]> => {
  const instance = getChangeData(change)
  const errors: SaltoElementError[] = []
  const response = await client.get({
    url: `/rest/api/3/field/${parent.value.id}/context`,
  })
  if (!isContextFieldResponse(response.data)) {
    log.debug(`Faild to fetch contexts for field ${parent.value.name}`)
    errors.push(
      createSaltoElementError({
        message: `Faild to fetch contexts for field ${parent.value.name}`,
        severity: 'Error',
        elemID: instance.elemID,
      }),
    )
    return errors
  }
  const contextNameToId = Object.fromEntries(response.data.values.map(val => [val.name, val.id]))
  const contextId = contextNameToId[instance.value.name]
  if (contextId === undefined) {
    log.debug(`Context ${instance.value.name} was not auto-generated in Jira`)
    errors.push(
      createSaltoElementError({
        message: `ContextField ${instance.value.name} was not auto-generates in Jira.`,
        severity: 'Error',
        elemID: instance.elemID,
      }),
    )
    return errors
  }
  instance.value.id = contextId
  return errors
}

const getOptionFromReference = (
  optionRef: ReferenceExpression,
  index: number,
  optionFullNameToChangeRecord: Record<string, Change<InstanceElement>>,
  beforeOrAfter: BeforeOrAfter,
): [string, Values] | undefined => {
  if (Object.prototype.hasOwnProperty.call(optionFullNameToChangeRecord, optionRef.elemID.getFullName())) {
    const optionChange = optionFullNameToChangeRecord[optionRef.elemID.getFullName()]
    if (Object.prototype.hasOwnProperty.call(optionChange.data, beforeOrAfter)) {
      const option = _.get(optionChange.data, beforeOrAfter)
      const optionValue = _.omit(option.value, CONTEXT_NAME_FIELD)
      return [optionValue.value, { ...optionValue, position: index + 1 }]
    }
    return undefined
  }
  const option = optionRef.value
  return [option.value.value, { ...option.value, position: index + 1 }]
}
const setOptionsToOriginal = (
  context: InstanceElement | undefined,
  beforeOrAfter: BeforeOrAfter,
  optionFullNameToChangeRecord: Record<string, Change<InstanceElement>>,
): void => {
  if (context === undefined) {
    return
  }
  if (!Array.isArray(context.value.options)) {
    return
  }
  context.value.options = Object.fromEntries(
    context.value.options
      .filter(isReferenceExpression)
      .map((optionRef, index) => getOptionFromReference(optionRef, index, optionFullNameToChangeRecord, beforeOrAfter))
      .filter(values.isDefined),
  )
}
const getContextChangeWithFixedOptions = (
  context: Change<InstanceElement>,
  optionFullNameToChangeRecord: Record<string, Change<InstanceElement>>,
): Change<InstanceElement> => {
  if (isRemovalChange(context)) {
    return context
  }
  const before = isModificationChange(context) ? context.data.before.clone() : undefined
  const after = context.data.after.clone()
  setOptionsToOriginal(before, 'before', optionFullNameToChangeRecord)
  setOptionsToOriginal(after, 'after', optionFullNameToChangeRecord)
  return toChange({ before, after })
}

const getOptionDeplymentResults = (
  deployResult: DeployResult,
  optionChanges: Change<InstanceElement>[],
): { successOptionChanges: Change<InstanceElement>[]; optionErrors: SaltoElementError[] } => {
  const successContextChanges = new Set<string>(
    deployResult.appliedChanges.filter(isInstanceChange).map(change => getChangeData(change).elemID.getFullName()),
  )

  const [successOptionChanges, failedOptionChanges] = _.partition(optionChanges, change =>
    successContextChanges.has(getParent(getChangeData(change)).elemID.getFullName()),
  )

  const optionErrors = failedOptionChanges.map(change =>
    createSaltoElementError({
      message: 'Failed to deploy context option change',
      severity: 'Error',
      elemID: getChangeData(change).elemID,
    }),
  )
  return { successOptionChanges, optionErrors }
}

const filter: FilterCreator = ({ client, config, paginator, elementsSource }) => ({
  name: 'contextDeploymentFilter',
  onFetch: async (elements: Element[]) => {
    const fieldType = findObject(elements, FIELD_TYPE_NAME)
    if (fieldType !== undefined) {
      setFieldDeploymentAnnotations(fieldType, 'contexts')
    }

    const fieldContextType = findObject(elements, FIELD_CONTEXT_TYPE_NAME)
    if (fieldContextType !== undefined) {
      await setContextDeploymentAnnotations(fieldContextType)
    }
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        (getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME ||
          getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME),
    )
    const instanceChanges = relevantChanges.filter(isInstanceChange)
    const [optionChanges, contextChanges] = _.partition(
      instanceChanges,
      change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_OPTION_TYPE_NAME,
    )
    const optionFullNameToChangeDict = _.keyBy(optionChanges, change => getChangeData(change).elemID.getFullName())

    const errors: SaltoElementError[] = []
    const deployResult = await deployChanges(contextChanges, async change => {
      const instance = getChangeData(change)
      // field contexts without fields cant be removed because they don't exist,
      // modification changes are also not allowed but will not crash.
      if (hasValidParent(instance) || !isRemovalChange(change)) {
        if (isAdditionChange(change) && hasValidParent(instance)) {
          const parent = getParent(instance)
          // checking if the field is jsm locked, and if so, we need to check that the context is auto-created.
          if (isRelatedToSpecifiedTerms(parent, [SERVICE]) && parent.value?.[IS_LOCKED] === true) {
            errors.push(...(await deployJsmContextField(change, parent, client)))
            return
          }
        }
        const changeToDeploy = getContextChangeWithFixedOptions(change, optionFullNameToChangeDict)
        await deployContextChange(changeToDeploy, client, config.apiDefinitions, paginator, elementsSource)
      }
    })

    const { successOptionChanges, optionErrors } = getOptionDeplymentResults(deployResult, optionChanges)

    return {
      leftoverChanges,
      deployResult: {
        errors: [...deployResult.errors, ...errors, ...optionErrors],
        appliedChanges: [...deployResult.appliedChanges, ...successOptionChanges],
      },
    }
  },
})

export default filter
