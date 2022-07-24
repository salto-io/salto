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
import { collections } from '@salto-io/lowerdash'
// import { isInstanceElement, PrimitiveType, ElemID, PrimitiveTypes, createRestriction, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { isInstanceElement, InstanceElement, isObjectType, MapType, PrimitiveType, ElemID, PrimitiveTypes, CORE_ANNOTATIONS, createRestriction, createRefToElmWithValue, TypeReference } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { LocalFilterCreator } from '../filter'
import { apiName } from '../transformers/transformer'
import { SALESFORCE } from '../constants'
// import { SALESFORCE } from '../constants'

const { awu } = collections.asynciterable

const metadataTypesWithFieldPermissions = [
  'Profile',
  'PermissionSet',
]

type FieldPermission = {
  field: string
  editable: boolean
  readable: boolean
}

const FIELD_PERMISSION_SCHEME = Joi.object({
  field: Joi.string().required(),
  editable: Joi.boolean().required(),
  readable: Joi.boolean().required(),
})

const isFieldPermission = createSchemeGuard<FieldPermission>(FIELD_PERMISSION_SCHEME, 'Received an invalid Field Permission value')

type FieldPermissionEnum = 'ReadOnly' | 'ReadWrite' | 'NoAccess'

const enumFieldPermissions = new PrimitiveType({
  elemID: new ElemID(SALESFORCE, 'fieldPermissionsValue'),
  primitive: PrimitiveTypes.STRING,
  annotations: {
    [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
      values: ['ReadOnly', 'ReadWrite', 'NoAccess'],
      enforce_value: true,
    }),
  },
})

let mapOfMapOfEnumFieldPermissions: TypeReference

const getMapOfMapOfEnumFieldPermissions = (): TypeReference => {
  if (mapOfMapOfEnumFieldPermissions === undefined) {
    mapOfMapOfEnumFieldPermissions = createRefToElmWithValue(
      new MapType(new MapType(enumFieldPermissions)),
    )
  }
  return mapOfMapOfEnumFieldPermissions
}

const permissionsObjectToEnum = (permissionsObject: FieldPermission): FieldPermissionEnum => {
  if (permissionsObject.editable && permissionsObject.readable) {
    return 'ReadWrite'
  }
  if (permissionsObject.readable) {
    return 'ReadOnly'
  }
  return 'NoAccess'
}


const filter: LocalFilterCreator = ({ config }) => ({
  onFetch: async elements => {
    if (config.enumFieldPermissions === false) {
      console.log('should not have done anything')
      // return
    }
    const profileType = await awu(elements).find(async element => isObjectType(element) && await apiName(element) === 'Profile')
    if (profileType !== undefined
      && isObjectType(profileType)
      && profileType.fields.fieldPermissions !== undefined) {
      profileType.fields.fieldPermissions.refType = getMapOfMapOfEnumFieldPermissions()
    }
    const permissionSetType = await awu(elements).find(async element => isObjectType(element) && await apiName(element) === 'PermissionSet')
    if (permissionSetType !== undefined
      && isObjectType(permissionSetType)
      && permissionSetType.fields.fieldPermissions !== undefined) {
      permissionSetType.fields.fieldPermissions.refType = getMapOfMapOfEnumFieldPermissions()
    }
    const profileAndPermissionSetInstances = await awu(elements)
      .filter(async element => (
        isInstanceElement(element)
        && metadataTypesWithFieldPermissions.includes(await apiName(await element.getType()))))
      .toArray() as InstanceElement[]
    profileAndPermissionSetInstances.forEach(profileOrPermissionSet => {
      const { fieldPermissions } = profileOrPermissionSet.value
      if (fieldPermissions === undefined) {
        return
      }
      profileOrPermissionSet.value.fieldPermissions = _.mapValues(
        fieldPermissions,
        objectPermission => _.mapValues(
          objectPermission,
          fieldPermission => {
            const validatedPermission = isFieldPermission(fieldPermission)
            if (validatedPermission === false) {
              return fieldPermission
            }
            return permissionsObjectToEnum(fieldPermission)
          }
        )
      )
    })
    console.log(profileType?.elemID.getFullName())
    console.log(permissionSetType?.elemID.getFullName())
    console.log(profileAndPermissionSetInstances.length)
  },
})

export default filter
