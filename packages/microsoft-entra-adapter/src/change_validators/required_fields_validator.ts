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
import { values as lowerDashValues, types } from '@salto-io/lowerdash'
import {
  Change,
  ChangeError,
  ChangeValidator,
  InstanceElement,
  getChangeData,
  isAdditionChange,
  isInstanceElement,
  isModificationChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import {
  AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME,
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  ODATA_PREFIX,
  ODATA_TYPE_FIELD_NACL_CASE,
  ROLE_DEFINITION_TYPE_NAME,
} from '../constants'

const log = logger(module)

const { isDefined } = lowerDashValues

type ValidateRequiredFieldsFunc = (instance: InstanceElement) => ChangeError | undefined
type ValidationRule = types.XOR<{ fieldNames: string[] }, { custom: ValidateRequiredFieldsFunc }>
type RequiredFieldsMap = Record<string, ValidationRule>

const validateRequiredFieldForLocation = (instance: InstanceElement): ChangeError | undefined => {
  const IP_LOCATION_DATA_TYPE = `${ODATA_PREFIX}ipNamedLocation`
  const COUNTRY_LOCATION_DATA_TYPE = `${ODATA_PREFIX}countryNamedLocation`
  if (_.isEmpty(_.get(instance.value, 'displayName'))) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Missing required field displayName',
      detailedMessage: `Instance ${instance.elemID.name} is missing required field displayName`,
    }
  }

  const locationType = _.get(instance.value, ODATA_TYPE_FIELD_NACL_CASE)
  switch (locationType) {
    case IP_LOCATION_DATA_TYPE: {
      const IP_RANGES_REQUIRED_FIELDS = ['cidrAddress', ODATA_TYPE_FIELD_NACL_CASE]

      const ipRangesField = _.get(instance.value, 'ipRanges')
      if (!_.isArray(ipRangesField)) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Required field ipRanges is either missing or has a bad format',
          detailedMessage: `Instance ${instance.elemID.name} is missing required field ipRanges or has a bad format. Expected Array of objects with fields ${IP_RANGES_REQUIRED_FIELDS.join(', ')}`,
        }
      }

      const invalidIpRangesIndices = ipRangesField
        .filter((ipRange: unknown, index: number): number | undefined => {
          const missingFields = IP_RANGES_REQUIRED_FIELDS.filter(fieldName => _.isEmpty(_.get(ipRange, fieldName)))
          return _.isEmpty(missingFields) ? index : undefined
        })
        .filter(isDefined)

      return invalidIpRangesIndices.length === 0
        ? undefined
        : {
            elemID: instance.elemID,
            severity: 'Error',
            message: `Missing required fields ${IP_RANGES_REQUIRED_FIELDS.join(', ')} in ipRanges`,
            detailedMessage: `Instance ${instance.elemID.name} is missing required fields ${IP_RANGES_REQUIRED_FIELDS.join(', ')} in ipRanges at indices ${invalidIpRangesIndices.join(', ')}`,
          }
    }
    case COUNTRY_LOCATION_DATA_TYPE:
      return _.isEmpty(_.get(instance.value, 'countriesAndRegions'))
        ? {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Missing required field countriesAndRegions',
            detailedMessage: `Instance ${instance.elemID.name} is missing required field countriesAndRegions`,
          }
        : undefined
    case undefined:
    default:
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Missing required fields ${ODATA_TYPE_FIELD_NACL_CASE}`,
        detailedMessage: `Instance ${instance.elemID.name} is missing required fields ${ODATA_TYPE_FIELD_NACL_CASE}`,
      }
  }
}

const TYPE_TO_VALIDATION_RULES_ON_ADDITION: RequiredFieldsMap = {
  [AUTHENTICATION_METHOD_CONFIGURATIONS_FIELD_NAME]: { fieldNames: [ODATA_TYPE_FIELD_NACL_CASE] },
  [AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME]: { fieldNames: ['allowedCombinations'] },
  [CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME]: { custom: validateRequiredFieldForLocation },
  [DIRECTORY_ROLE_TYPE_NAME]: { fieldNames: ['roleTemplateId'] },
  [ROLE_DEFINITION_TYPE_NAME]: { fieldNames: ['displayName', 'rolePermissions', 'isBuiltIn'] },
}

const TYPE_TO_VALIDATION_RULES_ON_MODIFICATION: RequiredFieldsMap = {
  [AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME]: { fieldNames: [ODATA_TYPE_FIELD_NACL_CASE] },
  [CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME]: { custom: validateRequiredFieldForLocation },
}

const validateForChangeType = ({
  changes,
  changeType,
}: {
  changes: readonly Change[]
  changeType: 'addition' | 'modification'
}): ChangeError[] => {
  const { validationRulesMap, filterFunc } =
    changeType === 'addition'
      ? {
          validationRulesMap: TYPE_TO_VALIDATION_RULES_ON_ADDITION,
          filterFunc: isAdditionChange,
        }
      : {
          validationRulesMap: TYPE_TO_VALIDATION_RULES_ON_MODIFICATION,
          filterFunc: isModificationChange,
        }

  const relevantChanges = changes
    .filter(filterFunc)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => Object.keys(validationRulesMap).includes(instance.elemID.typeName))

  return relevantChanges
    .map((instance): ChangeError | undefined => {
      const validationRule = validationRulesMap[instance.elemID.typeName]
      if (validationRule.fieldNames !== undefined) {
        const instanceFieldNames = Object.keys(instance.value)
        const missingFields = validationRule.fieldNames.filter(fieldName => !instanceFieldNames.includes(fieldName))
        return _.isEmpty(missingFields)
          ? undefined
          : {
              elemID: instance.elemID,
              severity: 'Error',
              message: `Missing required fields ${missingFields.join(', ')}`,
              detailedMessage: `Instance ${instance.elemID.name} is missing required fields ${missingFields.join(', ')} on ${changeType}`,
            }
      }
      return validationRule.custom(instance)
    })
    .filter(isDefined)
}

export const requiredFieldsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.warn('elementSource is undefined, skipping builtInInstancesValidator')
    return []
  }

  return [
    ...validateForChangeType({ changes, changeType: 'addition' }),
    ...validateForChangeType({ changes, changeType: 'modification' }),
  ]
}
