/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  AdditionChange,
  ChangeError,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  ModificationChange,
  toChange,
  Value,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP, resolvePath, setPath } from '@salto-io/adapter-utils'
import { ACCOUNT_SPECIFIC_VALUE, INIT_CONDITION, WORKFLOW } from '../constants'
import { getResolvedAccountSpecificValues } from '../filters/workflow_account_specific_values'
import { NetsuiteChangeValidator } from './types'
import { toAccountSpecificValuesWarning } from './account_specific_values'

const SEND_EMAIL_ACTION = 'sendemailaction'
const SENDER = 'sender'
const RECIPIENT = 'recipient'
const SPECIFIC = 'SPECIFIC'

const PARAMETER = 'parameter'

const toValidationError = (instance: InstanceElement, probField: string): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Workflow contains fields which cannot be deployed',
  detailedMessage: `The Workflow contains a '${probField}' field with an ACCOUNT_SPECIFIC_VALUE which cannot be deployed due to NetSuite constraints. Please refer to https://help.salto.io/en/articles/6845061-deploying-workflows-actions-with-account-specific-value for more information.`,
})

const toConditionParametersWarning = (elemID: ElemID): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: "Workflow Condition won't be deployed",
  detailedMessage:
    'This Workflow Condition includes an ACCOUNT_SPECIFIC_VALUE, which, due to NetSuite limitations, cannot be deployed.' +
    ' To ensure a smooth deployment, please edit the element in Salto and replace ACCOUNT_SPECIFIC_VALUE with the real value.' +
    ' Other non-restricted aspects of the Workflow will be deployed as usual.',
})

const findClosestInitConditionAncestorElemID = (elemID: ElemID): ElemID | undefined => {
  if (elemID.name === INIT_CONDITION) {
    return elemID
  }
  if (elemID.isTopLevel()) {
    return undefined
  }
  return findClosestInitConditionAncestorElemID(elemID.createParentID())
}

const isNestedValueChanged = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  nestedElemId: ElemID,
): boolean =>
  isAdditionChange(change) ||
  !isEqualValues(resolvePath(change.data.after, nestedElemId), resolvePath(change.data.before, nestedElemId))

const getChangeErrorsOnAccountSpecificValues = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
): ChangeError[] => {
  const instance = getChangeData(change)
  const sendEmailActionFieldsWithAccountSpecificValues = new Set<string>()
  const conditionsWithAccountSpecificValues = new Set<string>()
  let returnGenericAccountSpecificValuesWarning = false

  walkOnElement({
    element: instance,
    func: ({ value, path }) => {
      if (path.isAttrID()) {
        return WALK_NEXT_STEP.SKIP
      }
      if (path.createParentID().name === SEND_EMAIL_ACTION) {
        if (value?.[SENDER] === ACCOUNT_SPECIFIC_VALUE && value?.sendertype === SPECIFIC) {
          sendEmailActionFieldsWithAccountSpecificValues.add(SENDER)
        }
        if (value?.[RECIPIENT] === ACCOUNT_SPECIFIC_VALUE && value?.recipienttype === SPECIFIC) {
          sendEmailActionFieldsWithAccountSpecificValues.add(RECIPIENT)
        }
      }
      if (path.name === PARAMETER) {
        const conditionElemId = findClosestInitConditionAncestorElemID(path) ?? path
        if (
          !conditionsWithAccountSpecificValues.has(conditionElemId.getFullName()) &&
          Object.values(value).some((val: Value) => val?.value === ACCOUNT_SPECIFIC_VALUE) &&
          isNestedValueChanged(change, conditionElemId)
        ) {
          conditionsWithAccountSpecificValues.add(conditionElemId.getFullName())
        }
      }
      if (
        typeof value === 'string' &&
        value.includes(ACCOUNT_SPECIFIC_VALUE) &&
        ![SENDER, RECIPIENT].includes(path.name) &&
        path.createParentID(2).name !== PARAMETER
      ) {
        returnGenericAccountSpecificValuesWarning = true
      }
      return WALK_NEXT_STEP.RECURSE
    },
  })

  const sendEmailActionErrors = Array.from(sendEmailActionFieldsWithAccountSpecificValues).map(fieldName =>
    toValidationError(instance, fieldName),
  )

  const conditionWarnings = Array.from(conditionsWithAccountSpecificValues)
    .map(ElemID.fromFullName)
    .map(toConditionParametersWarning)

  return sendEmailActionErrors
    .concat(conditionWarnings)
    .concat(returnGenericAccountSpecificValuesWarning ? toAccountSpecificValuesWarning(instance) : [])
}

const changeValidator: NetsuiteChangeValidator = async (
  changes,
  { suiteQLNameToInternalIdsMap, internalIdToTypes },
) => {
  const workflowChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => change.data.after.elemID.typeName === WORKFLOW)

  if (workflowChanges.length === 0) {
    return []
  }
  const clonedWorkflowChanges = workflowChanges.map(
    change =>
      toChange({
        ...change.data,
        after: change.data.after.clone(),
      }) as AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  )

  const allResolveWarnings = clonedWorkflowChanges.flatMap(change => {
    const instance = getChangeData(change)
    const { resolvedAccountSpecificValues, resolveWarnings } = getResolvedAccountSpecificValues(
      instance,
      suiteQLNameToInternalIdsMap,
      internalIdToTypes,
    )
    resolvedAccountSpecificValues.forEach(({ path, value }) => setPath(instance, path, value))
    return resolveWarnings
  })

  const accountSpecificValuesErrors = clonedWorkflowChanges.flatMap(getChangeErrorsOnAccountSpecificValues)
  return allResolveWarnings.concat(accountSpecificValuesErrors)
}

export default changeValidator
