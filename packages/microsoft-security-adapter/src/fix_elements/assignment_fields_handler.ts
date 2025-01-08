/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { FixElementsHandler } from '@salto-io/adapter-components'
import { ChangeError, ElemID, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { Options } from '../definitions/types'
import { entraConstants, intuneConstants } from '../constants'
import {
  AssignmentFieldRuleWithFallback,
  ConditionalAccessPolicyAssignmentField,
  ConditionalAccessPolicyAssignmentFieldsConfig,
  IntuneAssignmentFieldsConfig,
} from '../config/assignment_fields'
import { UserConfig } from '../config'

const { isDefined } = lowerDashValues
const log = logger(module)

type FixedElementWithError = { fixedElement: InstanceElement; error: ChangeError }

const CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS_INFO: Record<
  ConditionalAccessPolicyAssignmentField,
  { parentField: string; isRequired?: boolean }
> = {
  includeApplications: { parentField: 'applications', isRequired: true },
  excludeApplications: { parentField: 'applications' },
  includeServicePrincipals: { parentField: 'clientApplications' },
  excludeServicePrincipals: { parentField: 'clientApplications' },
  includeUsers: { parentField: 'users', isRequired: true },
  excludeUsers: { parentField: 'users' },
  includeGroups: { parentField: 'users' },
  excludeGroups: { parentField: 'users' },
  includeRoles: { parentField: 'users' },
  excludeRoles: { parentField: 'users' },
  includeDevices: { parentField: 'devices' },
  excludeDevices: { parentField: 'devices' },
}

const generateFixedAssignmentsInfo = ({
  elemID,
  fieldName,
  rule,
}: {
  elemID: ElemID
  fieldName: string
  rule: AssignmentFieldRuleWithFallback
}): ChangeError => {
  const messagePrefix = `The "${fieldName}" field will be ${rule.strategy === 'omit' ? 'omitted' : 'replaced'}`
  return {
    elemID,
    severity: 'Info',
    message: messagePrefix,
    detailedMessage: `${messagePrefix}${rule.strategy === 'fallback' ? ` with ${safeJsonStringify(rule.fallbackValue)}` : ''} in the deployment, according to the assignmentFieldsStrategy configuration`,
  }
}

const handleAssignmentField = ({
  element,
  fieldPath,
  rule,
}: {
  element: InstanceElement
  fieldPath: string[]
  rule: AssignmentFieldRuleWithFallback
}): FixedElementWithError | undefined => {
  const fieldValue = _.get(element.value, fieldPath)
  if (_.isEmpty(fieldValue)) {
    return undefined
  }

  const fixedElement = element.clone()
  switch (rule.strategy) {
    case 'omit':
      _.set(fixedElement.value, fieldPath, undefined)
      break
    case 'fallback':
      if (_.isEqual(fieldValue, rule.fallbackValue)) {
        return undefined
      }
      _.set(fixedElement.value, fieldPath, rule.fallbackValue)
      break
    default:
      throw new Error(`Unknown assignment field strategy %o: ${rule}`)
  }

  return {
    fixedElement,
    error: generateFixedAssignmentsInfo({ elemID: element.elemID, fieldName: fieldPath.join('.'), rule }),
  }
}

const handleIntuneAssignmentsField = (
  elements: InstanceElement[],
  intuneConfig: IntuneAssignmentFieldsConfig,
): FixedElementWithError[] => {
  const intuneTypesToHandle = Object.keys(intuneConfig)
  const filteredElements = elements.filter(element => intuneTypesToHandle.includes(element.elemID.typeName))
  return Object.entries(intuneConfig).flatMap(([typeName, rule]) =>
    filteredElements
      .filter(element => typeName === element.elemID.typeName)
      .map(element =>
        handleAssignmentField({
          element,
          fieldPath: [intuneConstants.ASSIGNMENTS_FIELD_NAME],
          rule,
        }),
      )
      .filter(isDefined),
  )
}

const handleConditionalAccessPolicyAssignmentFieldsSingleElement = (
  element: InstanceElement,
  conditionalAccessConfig: ConditionalAccessPolicyAssignmentFieldsConfig,
): FixedElementWithError[] =>
  Object.entries(conditionalAccessConfig)
    .map(([field, configRule]) => {
      const fieldInfo =
        CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS_INFO[field as ConditionalAccessPolicyAssignmentField]

      if (fieldInfo === undefined) {
        log.error(`Unknown field ${field} configuration in ConditionalAccessPolicyAssignmentFieldsConfig`)
        return undefined
      }

      const rule =
        configRule.strategy === 'omit' && fieldInfo.isRequired
          ? ({ strategy: 'fallback', fallbackValue: ['None'] } as const)
          : configRule

      return handleAssignmentField({
        element,
        fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, fieldInfo.parentField, field],
        rule,
      })
    })
    .filter(isDefined)

const handleConditionalAccessPolicyAssignmentFields = (
  elements: InstanceElement[],
  conditionalAccessConfig: ConditionalAccessPolicyAssignmentFieldsConfig,
): FixedElementWithError[] =>
  elements
    .filter(element => element.elemID.typeName === entraConstants.TOP_LEVEL_TYPES.CONDITIONAL_ACCESS_POLICY_TYPE_NAME)
    .flatMap(element => handleConditionalAccessPolicyAssignmentFieldsSingleElement(element, conditionalAccessConfig))

/**
 * Handles selected assignment-related fields according to the user configuration.
 * An error with severity "Info" will be returned for each fixed instance.
 * The assignment related fields can be either omitted or replaced with a fallback value.
 */
export const assignmentFieldsHandler: FixElementsHandler<Options, UserConfig> =
  ({ config }) =>
  async elements => {
    const assignmentFieldsStrategy = config.deploy?.assignmentFieldsStrategy
    if (assignmentFieldsStrategy === undefined) {
      return { errors: [], fixedElements: [] }
    }

    const instances = elements.filter(isInstanceElement)

    const intuneResult = handleIntuneAssignmentsField(instances, assignmentFieldsStrategy.Intune ?? {})
    const entraResult = handleConditionalAccessPolicyAssignmentFields(
      instances,
      assignmentFieldsStrategy.EntraConditionalAccessPolicy ?? {},
    )

    return {
      errors: [...intuneResult, ...entraResult].map(result => result.error),
      fixedElements: [...intuneResult, ...entraResult].map(result => result.fixedElement),
    }
  }
