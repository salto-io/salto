/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import {
  ChangeValidator, getChangeElement, InstanceElement, ChangeError, isMapType, MapType, isObjectType,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues, resolveValues } from '@salto-io/adapter-utils'
import { getInstanceChanges, PROFILE_MAP_FIELD_DEF, defaultMapper } from '../filters/convert_maps'
import { API_NAME_SEPARATOR, PROFILE_METADATA_TYPE } from '../constants'
import { getLookUpName } from '../transformers/reference_mapping'

const isNum = (str: string | undefined): boolean => (
  !_.isEmpty(str) && !Number.isNaN(_.toNumber(str))
)

const getMapKeyErrors = (
  after: InstanceElement
): ChangeError[] => {
  const errors: ChangeError[] = []
  Object.entries(after.value).filter(
    ([fieldName]) => isMapType(after.type.fields[fieldName]?.type)
    && PROFILE_MAP_FIELD_DEF[fieldName] !== undefined
  ).forEach(([fieldName, fieldValues]) => {
    const fieldType = after.type.fields[fieldName].type as MapType
    const mapDef = PROFILE_MAP_FIELD_DEF[fieldName]
    const findInvalidPaths: TransformFunc = ({ value, path, field }) => {
      if (isObjectType(field?.type) && path !== undefined) {
        // we reached the map's inner value
        const expectedPath = defaultMapper(value[mapDef.key]).slice(0, mapDef.nested ? 2 : 1)
        const pathParts = path.getFullNameParts().filter(part => !isNum(part))
        const actualPath = pathParts.slice(-expectedPath.length)
        const previewPrefix = actualPath.slice(0, actualPath.findIndex(
          (val, idx) => val !== expectedPath[idx]
        ) + 1)
        if (!_.isEqual(actualPath, expectedPath)) {
          errors.push({
            elemID: after.elemID.createNestedID(fieldName, ...previewPrefix),
            severity: 'Error',
            message: `Incorrect map key in profile ${after.value.fullName} field ${fieldName}: ${previewPrefix?.join(API_NAME_SEPARATOR)} should be ${expectedPath.slice(0, previewPrefix.length).join(API_NAME_SEPARATOR)}`,
            detailedMessage: `Profile ${after.value.fullName} field ${fieldName}: Incorrect map key ${actualPath?.join(API_NAME_SEPARATOR)}, should be ${expectedPath.join(API_NAME_SEPARATOR)}`,
          })
        }
        return undefined
      }
      return value
    }

    transformValues({
      values: fieldValues,
      type: fieldType,
      transformFunc: findInvalidPaths,
      strict: false,
      pathID: after.elemID.createNestedID(fieldName),
    })
  })
  return errors
}

const changeValidator: ChangeValidator = async changes => (
  getInstanceChanges(changes, PROFILE_METADATA_TYPE).flatMap(change => getMapKeyErrors(
    resolveValues(getChangeElement(change), getLookUpName)
  ))
)

export default changeValidator
