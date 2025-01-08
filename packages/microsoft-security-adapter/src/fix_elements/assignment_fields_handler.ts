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
import { entraConstants } from '../constants'
import {
  UserConfig,
  AssignmentFieldRuleWithFallback,
  AssignmentFieldsConfig,
  ConditionalAccessPolicyAssignmentField,
  ConditionalAccessPolicyAssignmentFieldNamesConfig,
  IntuneAssignmentsFieldNamesConfig,
} from '../config'

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
    // TODO DOC-201: Add a link to our documentation
    detailedMessage: `${messagePrefix}${rule.strategy === 'fallback' ? ` with ${safeJsonStringify(rule.fallbackValue)}` : ''} in the deployment, according to the assignmentFieldsStrategy configuration`,
  }
}

const handleAssignmentField = ({
  instance,
  fieldPath,
  rule,
}: {
  instance: InstanceElement
  fieldPath: string[]
  rule: AssignmentFieldRuleWithFallback
}): FixedElementWithError | undefined => {
  const fieldValue = _.get(instance.value, fieldPath)
  if (_.isEmpty(fieldValue)) {
    return undefined
  }

  const fixedElement = instance.clone()
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

  log.trace(
    `Fixed assignment field ${fieldPath.join('.')} in ${instance.elemID.getFullName()} according to the assignmentFieldsStrategy configuration: ${rule.strategy}`,
  )
  return {
    fixedElement,
    error: generateFixedAssignmentsInfo({ elemID: instance.elemID, fieldName: fieldPath.join('.'), rule }),
  }
}

const calculateRuleToApplyWithPath = ({
  instance,
  fieldName,
  requestedRule,
}: {
  instance: InstanceElement
  fieldName: string
  requestedRule: AssignmentFieldRuleWithFallback
}): { rule: AssignmentFieldRuleWithFallback; fieldPath: string[] } | undefined => {
  if (instance.elemID.typeName !== entraConstants.TOP_LEVEL_TYPES.CONDITIONAL_ACCESS_POLICY_TYPE_NAME) {
    return { rule: requestedRule, fieldPath: [fieldName] }
  }
  const fieldInfo =
    CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS_INFO[fieldName as ConditionalAccessPolicyAssignmentField]

  if (fieldInfo === undefined) {
    log.error(`Unknown field ${fieldName} configuration in ConditionalAccessPolicyAssignmentFieldsConfig`)
    return undefined
  }

  const fieldPath = [entraConstants.CONDITIONS_FIELD_NAME, fieldInfo.parentField, fieldName]

  if (requestedRule.strategy === 'omit' && fieldInfo.isRequired) {
    return {
      rule: { strategy: 'fallback', fallbackValue: ['None'] },
      fieldPath,
    }
  }

  return { rule: requestedRule, fieldPath }
}

const handleAssignmentFieldsSingleInstance = (
  instance: InstanceElement,
  assignmentFieldsConfig: IntuneAssignmentsFieldNamesConfig | ConditionalAccessPolicyAssignmentFieldNamesConfig,
): FixedElementWithError[] =>
  Object.entries(assignmentFieldsConfig)
    .map(([fieldName, configRule]) => {
      const result = calculateRuleToApplyWithPath({ instance, fieldName, requestedRule: configRule })

      if (result === undefined) {
        return undefined
      }

      return handleAssignmentField({ instance, ...result })
    })
    .filter(isDefined)

const handleAssignmentFields = (
  instances: InstanceElement[],
  assignmentFieldsConfig: AssignmentFieldsConfig,
): FixedElementWithError[] => {
  const requestedTypeNames = Object.keys(assignmentFieldsConfig)
  const filteredInstances = instances.filter(instance => requestedTypeNames.includes(instance.elemID.typeName))
  return Object.entries(assignmentFieldsConfig).flatMap(([typeName, config]) => {
    const instancesWithTypeName = filteredInstances.filter(instance => instance.elemID.typeName === typeName)
    return instancesWithTypeName.flatMap(instance => handleAssignmentFieldsSingleInstance(instance, config))
  })
}

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
    const result = handleAssignmentFields(instances, assignmentFieldsStrategy)

    return {
      errors: result.map(res => res.error),
      fixedElements: result.map(res => res.fixedElement),
    }
  }
