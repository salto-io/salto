/*
 * Copyright 2024 Salto Labs Ltd.
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
  ConditionalAccessPolicyAssignmentField,
  OmitAssignmentFieldRule,
  OmitConditionalAccessPolicyAssignmentFieldsConfig,
} from '../config/omit_assignment_fields'
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

const generateOmitAssignmentsInfo = ({
  elemID,
  fieldName,
  rule,
}: {
  elemID: ElemID
  fieldName: string
  rule: OmitAssignmentFieldRule
}): ChangeError => {
  const messagePrefix = `The "${fieldName}" field will be ${rule.strategy === 'omit' ? 'omitted' : 'replaced'}`
  return {
    elemID,
    severity: 'Info',
    message: messagePrefix,
    detailedMessage: `${messagePrefix}${rule.strategy === 'fallback' ? ` with ${safeJsonStringify(rule.fallbackValue)}` : ''} in the deployment, according to the omitAssignmentField configuration`,
  }
}

const omitAssignmentField = ({
  element,
  fieldPath,
  rule,
}: {
  element: InstanceElement
  fieldPath: string[]
  rule: OmitAssignmentFieldRule
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
      throw new Error(`Unknown omit assignment field strategy %o: ${rule}`)
  }

  return {
    fixedElement,
    error: generateOmitAssignmentsInfo({ elemID: element.elemID, fieldName: fieldPath.join('.'), rule }),
  }
}

const omitAssignmentsFieldForIntuneTypes = (
  elements: InstanceElement[],
  intuneTypesToOmit: string[],
): FixedElementWithError[] =>
  elements
    .filter(element => intuneTypesToOmit.includes(element.elemID.typeName))
    .map(element =>
      omitAssignmentField({ element, fieldPath: [intuneConstants.ASSIGNMENTS_FIELD_NAME], rule: { strategy: 'omit' } }),
    )
    .filter(isDefined)

const omitConditionalAccessPolicyAssignmentFieldsSingleElement = (
  element: InstanceElement,
  omitConfig: OmitConditionalAccessPolicyAssignmentFieldsConfig,
): FixedElementWithError[] =>
  Object.entries(omitConfig)
    .map(([field, configRule]) => {
      const fieldInfo =
        CONDITIONAL_ACCESS_POLICY_ASSIGNMENT_FIELDS_INFO[field as ConditionalAccessPolicyAssignmentField]

      if (fieldInfo === undefined) {
        log.error(`Unknown field ${field} in omitConditionalAccessPolicyAssignmentFields`)
        return undefined
      }

      const rule =
        configRule.strategy === 'omit' && fieldInfo.isRequired
          ? ({ strategy: 'fallback', fallbackValue: ['None'] } as const)
          : configRule

      return omitAssignmentField({
        element,
        fieldPath: [entraConstants.CONDITIONS_FIELD_NAME, fieldInfo.parentField, field],
        rule,
      })
    })
    .filter(isDefined)

const omiConditionalAccessPolicyAssignmentFields = (
  elements: InstanceElement[],
  omitConfig: OmitConditionalAccessPolicyAssignmentFieldsConfig,
): FixedElementWithError[] =>
  elements
    .filter(element => element.elemID.typeName === entraConstants.CONDITIONAL_ACCESS_POLICY_TYPE_NAME)
    .flatMap(element => omitConditionalAccessPolicyAssignmentFieldsSingleElement(element, omitConfig))

/**
 TODO: add docstring
 */
export const omitAssignmentFieldsHandler: FixElementsHandler<Options, UserConfig> =
  ({ config }) =>
  async elements => {
    const omitAssignmentFields = config.deploy?.omitAssignmentFields
    if (omitAssignmentFields === undefined) {
      return { errors: [], fixedElements: [] }
    }

    const instances = elements.filter(isInstanceElement)

    const intuneResult = omitAssignmentsFieldForIntuneTypes(instances, omitAssignmentFields.Intune ?? [])
    const entraResult = omiConditionalAccessPolicyAssignmentFields(
      instances,
      omitAssignmentFields.EntraConditionalAccessPolicy ?? {},
    )

    return {
      errors: [...intuneResult, ...entraResult].map(result => result.error),
      fixedElements: [...intuneResult, ...entraResult].map(result => result.fixedElement),
    }
  }
