/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  isAdditionOrModificationChange,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc, TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'
import { defaultMapper, getMetadataTypeToFieldToMapDef } from '../filters/convert_maps'
import {
  API_NAME_SEPARATOR,
  MUTING_PERMISSION_SET_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from '../constants'
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'
import { FetchProfile } from '../types'

const metadataTypesToValidate = [
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
]

const isNum = (str: string | undefined): boolean => !_.isEmpty(str) && !Number.isNaN(_.toNumber(str))

const getMapKeyErrors = (after: InstanceElement, fetchProfile: FetchProfile): ChangeError[] => {
  const errors: ChangeError[] = []
  const type = after.getTypeSync()
  const typeName = apiNameSync(type) ?? ''
  const mapper = getMetadataTypeToFieldToMapDef(fetchProfile)[typeName]
  Object.entries(after.value)
    .filter(([fieldName]) => isMapType(type.fields[fieldName]?.getTypeSync()) && mapper[fieldName] !== undefined)
    .forEach(([fieldName, fieldValues]) => {
      const fieldType = type.fields[fieldName].getTypeSync() as MapType
      const mapDef = mapper[fieldName]
      const findInvalidPaths: TransformFuncSync = ({ value, path, field }) => {
        if (isObjectType(field?.getTypeSync()) && path !== undefined) {
          if (value[mapDef.key] === undefined) {
            errors.push({
              elemID: path,
              severity: 'Error',
              message: 'Nested value not found in field',
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
          const previewPrefix = actualPath.slice(0, actualPath.findIndex((val, idx) => val !== expectedPath[idx]) + 1)
          if (!_.isEqual(actualPath, expectedPath)) {
            errors.push({
              elemID: after.elemID.createNestedID(fieldName, ...previewPrefix),
              severity: 'Error',
              message: 'Incorrect map key in field',
              detailedMessage: `${typeName} ${after.value.fullName} field ${fieldName}: Incorrect map key ${actualPath?.join(API_NAME_SEPARATOR)}, should be ${expectedPath.join(API_NAME_SEPARATOR)}`,
            })
          }
          return undefined
        }
        return value
      }

      transformValuesSync({
        values: fieldValues,
        type: fieldType,
        transformFunc: findInvalidPaths,
        strict: false,
        allowEmptyArrays: true,
        allowExistingEmptyObjects: true,
        pathID: after.elemID.createNestedID(fieldName),
      })
    })
  return errors
}

const changeValidator =
  (getLookupNameFunc: GetLookupNameFunc, fetchProfile: FetchProfile): ChangeValidator =>
  async changes =>
    (
      await Promise.all(
        changes
          .filter(isAdditionOrModificationChange)
          .map(getChangeData)
          .filter(isInstanceOfTypeSync(...metadataTypesToValidate))
          .map(instance => resolveValues(instance, getLookupNameFunc)),
      )
    ).flatMap(instance => getMapKeyErrors(instance, fetchProfile))

export default changeValidator
