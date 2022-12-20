/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ChangeValidator,
  getChangeData,
  InstanceElement,
  ChangeError,
  isMapType,
  MapType,
  isObjectType,
  isAdditionOrModificationChange, isInstanceChange,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues, resolveValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { defaultMapper, metadataTypeToFieldToMapDef } from '../filters/convert_maps'
import { API_NAME_SEPARATOR, PERMISSION_SET_METADATA_TYPE, PROFILE_METADATA_TYPE } from '../constants'
import { getLookUpName } from '../transformers/reference_mapping'
import { isInstanceOfTypeChange } from '../filters/utils'
import { apiName } from '../transformers/transformer'

const { awu } = collections.asynciterable

const metadataTypesToValidate = [
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
]

const isNum = (str: string | undefined): boolean => (
  !_.isEmpty(str) && !Number.isNaN(_.toNumber(str))
)

const getMapKeyErrors = async (
  after: InstanceElement
): Promise<ChangeError[]> => {
  const errors: ChangeError[] = []
  const type = await after.getType()
  const typeName = await apiName(type)
  const mapper = metadataTypeToFieldToMapDef[typeName]
  await awu(Object.entries(after.value)).filter(
    async ([fieldName]) => isMapType(await (type).fields[fieldName]?.getType())
    && mapper[fieldName] !== undefined
  ).forEach(async ([fieldName, fieldValues]) => {
    const fieldType = await (type).fields[fieldName].getType() as MapType
    const mapDef = mapper[fieldName]
    const findInvalidPaths: TransformFunc = async ({ value, path, field }) => {
      if (isObjectType(await field?.getType()) && path !== undefined) {
        if (value[mapDef.key] === undefined) {
          errors.push({
            elemID: path,
            severity: 'Error',
            message: `Nested value '${mapDef.key}' not found in field '${fieldName}`,
            detailedMessage: `${typeName} ${after.value.fullName} field ${fieldName}: Nested value '${mapDef.key}' not found`,
          })
          return undefined
        }
        // this validation intend to catch unresolved reference, and should be removed after the general fix
        if (typeof value[mapDef.key] !== 'string') {
          return undefined
        }
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
            message: `Incorrect map key in ${typeName} ${after.value.fullName} field ${fieldName}: ${previewPrefix?.join(API_NAME_SEPARATOR)} should be ${expectedPath.slice(0, previewPrefix.length).join(API_NAME_SEPARATOR)}`,
            detailedMessage: `${typeName} ${after.value.fullName} field ${fieldName}: Incorrect map key ${actualPath?.join(API_NAME_SEPARATOR)}, should be ${expectedPath.join(API_NAME_SEPARATOR)}`,
          })
        }
        return undefined
      }
      return value
    }

    await transformValues({
      values: fieldValues,
      type: fieldType,
      transformFunc: findInvalidPaths,
      strict: false,
      allowEmpty: true,
      pathID: after.elemID.createNestedID(fieldName),
    })
  })
  return errors
}


const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isInstanceOfTypeChange(...metadataTypesToValidate))
    .flatMap(async change => getMapKeyErrors(
      await resolveValues(getChangeData(change), getLookUpName)
    ))
    .toArray()
)

export default changeValidator
