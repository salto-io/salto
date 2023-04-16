/*
*                      Copyright 2023 Salto Labs Ltd.
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
  Element, ElemID, Values, ObjectType, Field, TypeElement, BuiltinTypes, ListType, MapType,
  CORE_ANNOTATIONS, PrimitiveType, PrimitiveTypes,
} from '@salto-io/adapter-api'
import {
  findElements as findElementsByID, buildElementsSourceFromElements,
} from '@salto-io/adapter-utils'
import JSZip from 'jszip'
import * as constants from '../src/constants'
import {
  annotationsFileName, customFieldsFileName, standardFieldsFileName,
} from '../src/filters/custom_type_split'
import { getNamespaceFromString } from '../src/filters/utils'
import { FilterContext } from '../src/filter'
import { SYSTEM_FIELDS } from '../src/adapter'
import { buildFetchProfile } from '../src/fetch_profile/fetch_profile'

export const findElements = (
  elements: ReadonlyArray<Element>,
  ...name: ReadonlyArray<string>
): Element[] => {
  const expectedElemId = name.length === 1
    ? new ElemID(constants.SALESFORCE, name[0])
    : new ElemID(constants.SALESFORCE, name[0], 'instance', ...name.slice(1))
  return [...findElementsByID(elements, expectedElemId)]
}

export const createField = (parent: ObjectType, fieldType: TypeElement,
  fieldApiName: string, additionalAnnotations?: Values): Field => {
  const newField = new Field(parent, 'field', fieldType, {
    [constants.API_NAME]: fieldApiName,
    modifyMe: 'modifyMe',
    ...additionalAnnotations,
  })
  parent.fields.field = newField
  return newField
}

export const createMetadataTypeElement = (
  typeName: string,
  params: Partial<ConstructorParameters<typeof ObjectType>[0]>
): ObjectType => new ObjectType({
  ...params,
  annotations: {
    ...params.annotations,
    [constants.METADATA_TYPE]: typeName,
  },
  elemID: new ElemID(constants.SALESFORCE, typeName),
})

export const createCustomObjectType = (
  typeName: string,
  params: Partial<ConstructorParameters<typeof ObjectType>[0]>
): ObjectType => new ObjectType({
  ...params,
  annotations: {
    [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    [constants.API_NAME]: typeName,
    ...(params.annotations ?? {}),
  },
  elemID: new ElemID(constants.SALESFORCE, typeName),
})

export const createValueSetEntry = (
  name: string,
  defaultValue = false,
  label?: string,
  isActive?: boolean,
  color?: string,
): Values => _.omitBy(
  {
    [constants.CUSTOM_VALUE.FULL_NAME]: name,
    [constants.CUSTOM_VALUE.LABEL]: label || name,
    [constants.CUSTOM_VALUE.DEFAULT]: defaultValue,
    isActive,
    color,
  },
  _.isUndefined
)

export type ZipFile = {
  path: string
  content: string
}

export const createEncodedZipContent = async (files: ZipFile[],
  encoding: BufferEncoding = 'base64'):
  Promise<string> => {
  const zip = new JSZip()
  files.forEach(file => zip.file(file.path, file.content))
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString(encoding)
}

export const findCustomFieldsObject = (elements: Element[], name: string): ObjectType => {
  const customObjects = findElements(elements, name) as ObjectType[]
  return customObjects
    .find(obj => obj.path?.slice(-1)[0] === customFieldsFileName(name)) as ObjectType
}

export const findStandardFieldsObject = (elements: Element[], name: string): ObjectType => {
  const customObjects = findElements(elements, name) as ObjectType[]
  return customObjects
    .find(obj => obj.path?.slice(-1)[0] === standardFieldsFileName(name)) as ObjectType
}

export const findAnnotationsObject = (elements: Element[], name: string): ObjectType => {
  const customObjects = findElements(elements, name) as ObjectType[]
  return customObjects
    .find(obj => obj.path?.slice(-1)[0] === annotationsFileName(name)) as ObjectType
}

export const findFullCustomObject = (elements: Element[], name: string): ObjectType => {
  const customObjects = findElements(elements, name) as ObjectType[]
  return new ObjectType({
    elemID: customObjects[0].elemID,
    annotationRefsOrTypes: Object.fromEntries(
      customObjects.flatMap(obj => Object.entries(obj.annotationRefTypes))
    ),
    annotations: Object.fromEntries(
      customObjects.flatMap(obj => Object.entries(obj.annotations))
    ),
    fields: Object.fromEntries(
      customObjects.flatMap(obj => Object.entries(obj.fields))
    ),
    isSettings: customObjects[0].isSettings,
  })
}

export const generateProfileType = (useMaps = false, preDeploy = false): ObjectType => {
  const ProfileApplicationVisibility = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'ProfileApplicationVisibility'),
    fields: {
      application: { refType: BuiltinTypes.STRING },
      default: { refType: BuiltinTypes.BOOLEAN },
      visible: { refType: BuiltinTypes.BOOLEAN },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'ProfileApplicationVisibility',
    },
  })
  const ProfileLayoutAssignment = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'ProfileLayoutAssignment'),
    fields: {
      layout: { refType: BuiltinTypes.STRING },
      recordType: { refType: BuiltinTypes.STRING },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'ProfileLayoutAssignment',
    },
  })
  const ProfileFieldLevelSecurity = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'ProfileFieldLevelSecurity'),
    fields: {
      field: { refType: BuiltinTypes.STRING },
      editable: { refType: BuiltinTypes.BOOLEAN },
      readable: { refType: BuiltinTypes.BOOLEAN },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'ProfileFieldLevelSecurity',
    },
  })

  // we only define types as lists if they use non-unique maps - so for onDeploy, fieldPermissions
  // will not appear as a list unless conflicts were found during the previous fetch
  const fieldPermissionsNonMapType = preDeploy
    ? ProfileFieldLevelSecurity
    : new ListType(ProfileFieldLevelSecurity)

  if (useMaps || preDeploy) {
    // mark key fields as _required=true
    ProfileApplicationVisibility.fields.application.annotations[CORE_ANNOTATIONS.REQUIRED] = true
    ProfileLayoutAssignment.fields.layout.annotations[CORE_ANNOTATIONS.REQUIRED] = true
    ProfileFieldLevelSecurity.fields.field.annotations[CORE_ANNOTATIONS.REQUIRED] = true
  }

  return new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, constants.PROFILE_METADATA_TYPE),
    fields: {
      [constants.INSTANCE_FULL_NAME_FIELD]: {
        refType: BuiltinTypes.STRING,
      },
      applicationVisibilities: { refType: useMaps
        ? new MapType(ProfileApplicationVisibility)
        : ProfileApplicationVisibility },
      layoutAssignments: { refType: useMaps
        ? new MapType(new ListType(ProfileLayoutAssignment))
        : new ListType(ProfileLayoutAssignment) },
      fieldPermissions: { refType: useMaps
        ? new MapType(new MapType(ProfileFieldLevelSecurity))
        : fieldPermissionsNonMapType },
    },
    annotations: {
      [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
    },
  })
}

export const generatePermissionSetType = (useMaps = false, preDeploy = false): ObjectType => {
  const PermissionSetApplicationVisibility = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'PermissionSetApplicationVisibility'),
    fields: {
      application: { refType: BuiltinTypes.STRING },
      default: { refType: BuiltinTypes.BOOLEAN },
      visible: { refType: BuiltinTypes.BOOLEAN },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'PermissionSetApplicationVisibility',
    },
  })
  const PermissionSetFieldLevelSecurity = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'PermissionSetFieldLevelSecurity'),
    fields: {
      field: { refType: BuiltinTypes.STRING },
      editable: { refType: BuiltinTypes.BOOLEAN },
      readable: { refType: BuiltinTypes.BOOLEAN },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'PermissionSetFieldLevelSecurity',
    },
  })

  // we only define types as lists if they use non-unique maps - so for onDeploy, fieldPermissions
  // will not appear as a list unless conflicts were found during the previous fetch
  const fieldPermissionsNonMapType = preDeploy
    ? PermissionSetFieldLevelSecurity
    : new ListType(PermissionSetFieldLevelSecurity)

  if (useMaps || preDeploy) {
    // mark key fields as _required=true
    PermissionSetApplicationVisibility.fields.application
      .annotations[CORE_ANNOTATIONS.REQUIRED] = true
    PermissionSetFieldLevelSecurity.fields.field.annotations[CORE_ANNOTATIONS.REQUIRED] = true
  }

  return new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, constants.PROFILE_METADATA_TYPE),
    fields: {
      [constants.INSTANCE_FULL_NAME_FIELD]: {
        refType: BuiltinTypes.STRING,
      },
      applicationVisibilities: { refType: useMaps
        ? new MapType(PermissionSetApplicationVisibility)
        : PermissionSetApplicationVisibility },
      fieldPermissions: { refType: useMaps
        ? new MapType(new MapType(PermissionSetFieldLevelSecurity))
        : fieldPermissionsNonMapType },
    },
    annotations: {
      [constants.METADATA_TYPE]: constants.PERMISSION_SET_METADATA_TYPE,
    },
  })
}

const stringType = new PrimitiveType({
  elemID: new ElemID(constants.SALESFORCE, 'Text'),
  primitive: PrimitiveTypes.STRING,
  annotationRefsOrTypes: {
    [constants.LABEL]: BuiltinTypes.STRING,
  },
})
const idType = new PrimitiveType({
  elemID: new ElemID('id'),
  primitive: PrimitiveTypes.STRING,
})

export const createCustomSettingsObject = (
  name: string,
  settingsType: string,
): ObjectType => {
  const namespace = getNamespaceFromString(name)
  const basicFields = {
    Id: {
      refType: idType,
      label: 'id',
      annotations: {
        [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [constants.LABEL]: 'Record ID',
        [constants.API_NAME]: 'Id',
      },
    },
    Name: {
      refType: stringType,
      label: 'Name',
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [constants.LABEL]: 'Name',
        [constants.API_NAME]: 'Name',
        [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
        [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
      },
    },
    // eslint-disable-next-line camelcase
    TestField__c: {
      label: 'TestField',
      refType: stringType,
      annotations: {
        [constants.LABEL]: 'TestField',
        [constants.API_NAME]: `${name}.TestField__c`,
        [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
        [constants.FIELD_ANNOTATIONS.QUERYABLE]: true,
      },
      annotationRefsOrTypes: {
        [constants.LABEL]: BuiltinTypes.STRING,
        [constants.API_NAME]: BuiltinTypes.STRING,
      },
    },
  }
  const obj = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, name),
    annotations: {
      [constants.API_NAME]: name,
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      [constants.CUSTOM_SETTINGS_TYPE]: settingsType,
    },
    annotationRefsOrTypes: {
      [constants.CUSTOM_SETTINGS_TYPE]: BuiltinTypes.STRING,
      [constants.METADATA_TYPE]: BuiltinTypes.STRING,
    },
    fields: basicFields,
  })
  const path = namespace
    ? [constants.SALESFORCE, constants.INSTALLED_PACKAGES_PATH, namespace,
      constants.OBJECTS_PATH, obj.elemID.name]
    : [constants.SALESFORCE, constants.OBJECTS_PATH, obj.elemID.name]
  obj.path = path
  return obj
}

export const defaultFilterContext: FilterContext = {
  systemFields: SYSTEM_FIELDS,
  fetchProfile: buildFetchProfile({}),
  elementsSource: buildElementsSourceFromElements([]),
  enumFieldPermissions: false,
}
