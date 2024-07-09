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
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { getParent, hasValidParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { deployContextChange, setContextDeploymentAnnotations } from './contexts'
import { deployChanges } from '../../deployment/standard_deployment'
import { FIELD_CONTEXT_OPTION_TYPE_NAME, FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from './constants'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'

type BeforeOrAfter = 'before' | 'after'

const getOptionFromReference = (
  optionRef: ReferenceExpression,
  index: number,
  optionFullNameToChangeRecord: Record<string, Change<InstanceElement>>,
  beforeOrAfter: BeforeOrAfter,
): [string, Values] | undefined => {
  // const option = Object.prototype.hasOwnProperty.call(optionFullNameToChangeRecord, optionRef.elemID.getFullName())
  //   ? _.get(optionFullNameToChangeRecord[optionRef.elemID.getFullName()].data, beforeOrAfter)
  //   : optionRef.value
  // const optionValue = _.omit(option.value, CONTEXT_NAME_FIELD)
  // return [optionValue.value, { ...optionValue, position: index + 1 }]
  if (Object.prototype.hasOwnProperty.call(optionFullNameToChangeRecord, optionRef.elemID.getFullName())) {
    const optionChange = optionFullNameToChangeRecord[optionRef.elemID.getFullName()]
    const option = _.get(optionChange.data, beforeOrAfter)
    const optionValue = option.value
    return [optionValue.value, { ...optionValue.value, position: index + 1 }]
  }
  const optionValue = optionRef.value.value
  return [optionValue.value, { ...optionValue, position: index + 1 }]
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
    const deployResult = await deployChanges(contextChanges.filter(isInstanceChange), async change => {
      // field contexts without fields cant be removed because they don't exist,
      // modification changes are also not allowed but will not crash.
      if (hasValidParent(getChangeData(change)) || !isRemovalChange(change)) {
        const changeToDeploy = getContextChangeWithFixedOptions(change, optionFullNameToChangeDict)
        await deployContextChange(changeToDeploy, client, config.apiDefinitions, paginator, elementsSource)
      }
    })

    const { successOptionChanges, optionErrors } = getOptionDeplymentResults(deployResult, optionChanges)

    return {
      leftoverChanges,
      deployResult: {
        errors: [...deployResult.errors, ...optionErrors],
        appliedChanges: [...deployResult.appliedChanges, ...successOptionChanges],
      },
    }
  },
})

export default filter
