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
  Element, ElemID, Values, ObjectType, Field, TypeElement, BuiltinTypes, ListType, MapType,
  CORE_ANNOTATIONS, PrimitiveType, PrimitiveTypes,
} from '@salto-io/adapter-api'
import { findElements as findElementsByID, createRefToElmWithValue } from '@salto-io/adapter-utils'
import JSZip from 'jszip'
import * as constants from '../src/constants'
import {
  annotationsFileName, customFieldsFileName, standardFieldsFileName,
} from '../src/filters/custom_object_split'
import { getNamespaceFromString } from '../src/filters/utils'

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

export type MockFunction<T extends (...args: never[]) => unknown> =
  jest.Mock<ReturnType<T>, Parameters<T>>

export type MockInterface<T extends {}> = {
  [k in keyof T]: T[k] extends (...args: never[]) => unknown
    ? MockFunction<T[k]>
    : MockInterface<T[k]>
}

export const mockFunction = <T extends (...args: never[]) => unknown>(): MockFunction<T> => (
  jest.fn()
)

export const generateProfileType = (useMaps = false, preDeploy = false): ObjectType => {
  const ProfileApplicationVisibility = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'ProfileApplicationVisibility'),
    fields: {
      application: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      default: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
      visible: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'ProfileApplicationVisibility',
    },
  })
  const ProfileLayoutAssignment = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'ProfileLayoutAssignment'),
    fields: {
      layout: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recordType: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    },
    annotations: {
      [constants.METADATA_TYPE]: 'ProfileLayoutAssignment',
    },
  })
  const ProfileFieldLevelSecurity = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'ProfileFieldLevelSecurity'),
    fields: {
      field: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      editable: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
      readable: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
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

  return new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, constants.PROFILE_METADATA_TYPE),
    fields: {
      [constants.INSTANCE_FULL_NAME_FIELD]: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
      },
      applicationVisibilities: { refType: useMaps
        ? createRefToElmWithValue(new MapType(ProfileApplicationVisibility))
        : createRefToElmWithValue(ProfileApplicationVisibility) },
      layoutAssignments: { refType: useMaps
        ? createRefToElmWithValue(new MapType(new ListType(ProfileLayoutAssignment)))
        : createRefToElmWithValue(new ListType(ProfileLayoutAssignment)) },
      fieldPermissions: { refType: useMaps
        ? createRefToElmWithValue(new MapType(new MapType(ProfileFieldLevelSecurity)))
        : createRefToElmWithValue(fieldPermissionsNonMapType) },
    },
    annotations: {
      [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
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
      refType: createRefToElmWithValue(idType),
      label: 'id',
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [constants.LABEL]: 'Record ID',
        [constants.API_NAME]: 'Id',
      },
    },
    Name: {
      refType: createRefToElmWithValue(stringType),
      label: 'Name',
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [constants.LABEL]: 'Name',
        [constants.API_NAME]: 'Name',
        [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
      },
    },
    // eslint-disable-next-line @typescript-eslint/camelcase
    TestField__c: {
      label: 'TestField',
      refType: createRefToElmWithValue(stringType),
      annotations: {
        [constants.LABEL]: 'TestField',
        [constants.API_NAME]: `${name}.TestField__c`,
        [constants.FIELD_ANNOTATIONS.CREATABLE]: true,
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
