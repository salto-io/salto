/*
 * Copyright 2024 Salto Labs Ltd.
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
import { GetLookupNameFunc, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { resolveValues } from '@salto-io/adapter-components'

import { collections } from '@salto-io/lowerdash'
import { defaultMapper, getMetadataTypeToFieldToMapDef } from '../filters/convert_maps'
import {
  API_NAME_SEPARATOR,
  MUTING_PERMISSION_SET_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
} from '../constants'
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'
import { FetchProfile } from '../types'

const { awu } = collections.asynciterable

const metadataTypesToValidate = [
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
]

const isNum = (str: string | undefined): boolean => !_.isEmpty(str) && !Number.isNaN(_.toNumber(str))

const getMapKeyErrors = async (after: InstanceElement, fetchProfile: FetchProfile): Promise<ChangeError[]> => {
  const errors: ChangeError[] = []
  const type = after.getTypeSync()
  const typeName = apiNameSync(type) ?? ''
  const mapper = getMetadataTypeToFieldToMapDef(fetchProfile)[typeName]
  await awu(
    Object.entries(after.value).filter(
      ([fieldName]) => isMapType(type.fields[fieldName]?.getTypeSync()) && mapper[fieldName] !== undefined,
    ),
  ).forEach(async ([fieldName, fieldValues]) => {
    const fieldType = type.fields[fieldName].getTypeSync() as MapType
    const mapDef = mapper[fieldName]
    const findInvalidPaths: TransformFunc = async ({ value, path, field }) => {
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

    await transformValues({
      values: fieldValues,
      type: fieldType,
      transformFunc: findInvalidPaths,
      strict: false,
      allowEmptyArrays: true,
      allowEmptyObjects: true,
      pathID: after.elemID.createNestedID(fieldName),
    })
  })
  return errors
}

const changeValidator =
  (getLookupNameFunc: GetLookupNameFunc, fetchProfile: FetchProfile): ChangeValidator =>
  async changes =>
    awu(
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceOfTypeSync(...metadataTypesToValidate)),
    )
      .flatMap(async instance => getMapKeyErrors(await resolveValues(instance, getLookupNameFunc), fetchProfile))
      .toArray()

export default changeValidator
