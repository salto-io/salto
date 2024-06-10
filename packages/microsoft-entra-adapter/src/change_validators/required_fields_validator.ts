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
  AdditionChange,
  ChangeError,
  ChangeValidator,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import {
  AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME,
  AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME,
  CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME,
  DIRECTORY_ROLE_TYPE_NAME,
  ODATA_PREFIX,
  ODATA_TYPE_FIELD_NACL_CASE,
  ROLE_DEFINITION_TYPE_NAME,
} from '../constants'

const { isDefined } = lowerDashValues

type ValidateRequiredFieldsFunc = (instance: InstanceElement) => ChangeError | undefined
type ValidationRule = types.XOR<{ fieldNames: string[] }, { custom: ValidateRequiredFieldsFunc }>
type RequiredFieldsMap = Record<string, ValidationRule>

/*
 * Validates required fields and subfields for instances of conditionalAccessPolicyNamedLocation based on their locationType.
 */
const validateRequiredFieldsForLocation = (instance: InstanceElement): ChangeError | undefined => {
  const IP_LOCATION_DATA_TYPE = `${ODATA_PREFIX}ipNamedLocation`
  const COUNTRY_LOCATION_DATA_TYPE = `${ODATA_PREFIX}countryNamedLocation`
  if (_.isEmpty(_.get(instance.value, 'displayName'))) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Missing required fields',
      detailedMessage: 'The required field displayName is missing',
    }
  }

  const locationType = _.get(instance.value, ODATA_TYPE_FIELD_NACL_CASE)
  switch (locationType) {
    case IP_LOCATION_DATA_TYPE: {
      const IP_RANGES_REQUIRED_FIELDS = ['cidrAddress', ODATA_TYPE_FIELD_NACL_CASE]

      const ipRangesField = _.get(instance.value, 'ipRanges')
      if (!_.isArray(ipRangesField) || _.isEmpty(ipRangesField)) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Required field ipRanges is either missing or has a bad format',
          detailedMessage: `The required field ipRanges is missing or has a bad format. Expected Array of objects with fields ${IP_RANGES_REQUIRED_FIELDS.join(', ')}`,
        }
      }

      const invalidIpRangesIndices = ipRangesField
        .map((ipRange: unknown, index: number): number | undefined => {
          const missingFields = IP_RANGES_REQUIRED_FIELDS.filter(fieldName => _.isEmpty(_.get(ipRange, fieldName)))
          return _.isEmpty(missingFields) ? undefined : index
        })
        .filter(isDefined)
      return invalidIpRangesIndices.length === 0
        ? undefined
        : {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Missing required fields',
            detailedMessage: `The required fields: ${IP_RANGES_REQUIRED_FIELDS.join(', ')} in ipRanges at indices ${invalidIpRangesIndices.join(', ')} are missing`,
          }
    }
    case COUNTRY_LOCATION_DATA_TYPE:
      return _.isEmpty(_.get(instance.value, 'countriesAndRegions'))
        ? {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Missing required fields',
            detailedMessage: 'The required field countriesAndRegions is missing',
          }
        : undefined
    case undefined:
    default:
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Missing required fields',
        detailedMessage: `The required field ${ODATA_TYPE_FIELD_NACL_CASE} is missing`,
      }
  }
}

const TYPE_TO_VALIDATION_RULES_ON_ADDITION: RequiredFieldsMap = {
  [CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME]: { custom: validateRequiredFieldsForLocation },
  [AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME]: { fieldNames: [ODATA_TYPE_FIELD_NACL_CASE] },
  [AUTHENTICATION_STRENGTH_POLICY_TYPE_NAME]: { fieldNames: ['allowedCombinations'] },
  [DIRECTORY_ROLE_TYPE_NAME]: { fieldNames: ['roleTemplateId'] },
  [ROLE_DEFINITION_TYPE_NAME]: { fieldNames: ['displayName', 'rolePermissions', 'isBuiltIn'] },
}

const TYPE_TO_VALIDATION_RULES_ON_MODIFICATION: RequiredFieldsMap = {
  [CONDITIONAL_ACCESS_POLICY_NAMED_LOCATION_TYPE_NAME]: { custom: validateRequiredFieldsForLocation },
  [AUTHENTICATION_METHOD_CONFIGURATION_TYPE_NAME]: { fieldNames: [ODATA_TYPE_FIELD_NACL_CASE] },
}

/*
 * Validates that all required fields are present in the given change, according to the given validation rules.
 */
const validateSingleChange = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
): ChangeError | undefined => {
  const isAddition = isAdditionChange(change)
  const instance = getChangeData(change)
  const validationRulesMap = isAddition
    ? TYPE_TO_VALIDATION_RULES_ON_ADDITION
    : TYPE_TO_VALIDATION_RULES_ON_MODIFICATION
  const validationRule = validationRulesMap[instance.elemID.typeName]
  if (validationRule?.custom !== undefined) {
    return validationRule.custom(instance)
  }
  if (validationRule?.fieldNames !== undefined) {
    const instanceFieldNames = Object.keys(instance.value)
    const missingFields = validationRule.fieldNames.filter(fieldName => !instanceFieldNames.includes(fieldName))
    return _.isEmpty(missingFields)
      ? undefined
      : {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Missing required fields',
          detailedMessage: `The following fields ${missingFields.join(', ')} are missing and required on ${isAddition ? 'addition' : 'modification'} changes.`,
        }
  }
  return undefined
}

/*
 * Validates that all required fields are present in the instances on addition and modification changes.
 */
export const requiredFieldsValidator: ChangeValidator = async changes =>
  changes.filter(isInstanceChange).filter(isAdditionOrModificationChange).map(validateSingleChange).filter(isDefined)
