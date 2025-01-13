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
  IntuneAssignmentsField,
} from '../config'

const { isDefined } = lowerDashValues
const log = logger(module)

type FieldName = ConditionalAccessPolicyAssignmentField | IntuneAssignmentsField
type FixedElementWithError = { fixedElement: InstanceElement; error: ChangeError }

const ASSIGNMENT_FIELDS_INFO: Record<FieldName, { fieldPath: string[]; emptyValue?: string[] }> = {
  includeApplications: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'applications'], emptyValue: ['None'] },
  excludeApplications: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'applications'] },
  includeServicePrincipals: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'clientApplications'] },
  excludeServicePrincipals: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'clientApplications'] },
  includeUsers: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'users'], emptyValue: ['None'] },
  excludeUsers: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'users'] },
  includeGroups: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'users'] },
  excludeGroups: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'users'] },
  includeRoles: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'users'] },
  excludeRoles: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'users'] },
  includeDevices: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'devices'] },
  excludeDevices: { fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, 'devices'] },
  assignments: { fieldPath: [], emptyValue: [] },
}

const generateFixedAssignmentsInfo = ({
  elemID,
  appliedRules,
}: {
  elemID: ElemID
  appliedRules: { fieldPath: string[]; rule: AssignmentFieldRuleWithFallback }[]
}): ChangeError => {
  const messagePrefix = 'Changes were made to assignment-related fields'
  const detailedMessageFieldDetails = appliedRules
    .map(({ fieldPath, rule }) => {
      const fieldName = fieldPath.join('.')
      return ` — Field "${fieldName}" was ${rule.strategy === 'fallback' ? `replaced with ${safeJsonStringify(rule.fallbackValue)}` : 'omitted'}`
    })
    .join('\n')

  return {
    elemID,
    severity: 'Info',
    message: messagePrefix,
    // TODO DOC-201: Add a link to our documentation
    detailedMessage: `${messagePrefix} according to the assignmentFieldsStrategy configuration:\n${detailedMessageFieldDetails}`,
  }
}

const createFixedElementWithAppliedRule = ({
  instance,
  fieldPath,
  rule,
}: {
  instance: InstanceElement
  fieldPath: string[]
  rule: AssignmentFieldRuleWithFallback
}): InstanceElement | undefined => {
  const fieldValue = _.get(instance.value, fieldPath)
  const fixedElement = instance.clone()

  switch (rule.strategy) {
    case 'omit':
      if (_.isEmpty(fieldValue)) {
        return undefined
      }
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
  return fixedElement
}

const calculateRuleToApplyWithPath = ({
  fieldName,
  requestedRule,
}: {
  fieldName: FieldName
  requestedRule: AssignmentFieldRuleWithFallback
}): { rule: AssignmentFieldRuleWithFallback; fieldPath: string[] } | undefined => {
  const fieldInfo = ASSIGNMENT_FIELDS_INFO[fieldName]
  if (fieldInfo === undefined) {
    log.error(`Unknown field ${fieldName} configuration in the assignmentFieldsStrategy`)
    return undefined
  }

  const fieldPath = [...fieldInfo.fieldPath, fieldName]

  if (requestedRule.strategy === 'omit' && fieldInfo.emptyValue !== undefined) {
    return {
      rule: { strategy: 'fallback', fallbackValue: fieldInfo.emptyValue },
      fieldPath,
    }
  }

  return { rule: requestedRule, fieldPath }
}

const handleInstanceAssignmentFields = (
  instance: InstanceElement,
  assignmentFieldsConfig: IntuneAssignmentsFieldNamesConfig | ConditionalAccessPolicyAssignmentFieldNamesConfig,
): FixedElementWithError | undefined => {
  let resultFixedElement = instance
  const appliedRules = Object.entries(assignmentFieldsConfig)
    .map(([fieldName, configRule]) => {
      const ruleToApplyWithPath = calculateRuleToApplyWithPath({
        fieldName: fieldName as FieldName,
        requestedRule: configRule,
      })

      if (ruleToApplyWithPath !== undefined) {
        const fixedElement = createFixedElementWithAppliedRule({ instance: resultFixedElement, ...ruleToApplyWithPath })
        if (fixedElement !== undefined) {
          resultFixedElement = fixedElement
          return ruleToApplyWithPath
        }
      }

      return undefined
    })
    .filter(isDefined)

  if (_.isEmpty(appliedRules)) {
    return undefined
  }

  const error = generateFixedAssignmentsInfo({
    elemID: instance.elemID,
    appliedRules,
  })

  return { fixedElement: resultFixedElement, error }
}

const handleAssignmentFields = (
  instances: InstanceElement[],
  assignmentFieldsConfig: AssignmentFieldsConfig,
): FixedElementWithError[] => {
  const configuredTypeNames = Object.keys(assignmentFieldsConfig)
  const relevantInstances = instances.filter(instance => configuredTypeNames.includes(instance.elemID.typeName))
  const typeNameToInstancesMap = _.groupBy(relevantInstances, instance => instance.elemID.typeName)
  return Object.entries(assignmentFieldsConfig)
    .flatMap(([typeName, config]) => {
      const instancesWithTypeName = typeNameToInstancesMap[typeName] ?? []
      return instancesWithTypeName.flatMap(instance => handleInstanceAssignmentFields(instance, config))
    })
    .filter(isDefined)
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
