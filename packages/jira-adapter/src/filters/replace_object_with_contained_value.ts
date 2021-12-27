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
import {
  BuiltinTypesByFullName,
  createRefToElmWithValue,
  Element,
  Field,
  InstanceElement,
  isInstanceElement,
  isListType,
  isMapType,
  isObjectType,
  isType,
  ListType,
  MapType,
  TypeElement,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable
const log = logger(module)

type ContainerValueType = {
  type: string | ContainerValueType
  container: 'list' | 'map'
}

type ContainedValueType = string | ContainerValueType

export type ReplaceObjectWithContainedValueConfig = {
  containedValuePath: string
  containedValueType: ContainedValueType
}

const DEFAULT_CONFIG: Record<string, ReplaceObjectWithContainedValueConfig> = {
  WorkflowSchemeAssociations: {
    containedValuePath: 'workflowScheme',
    containedValueType: 'WorkflowScheme',
  },
  IssueTypeScreenSchemesProjects: {
    containedValuePath: 'issueTypeScreenScheme.id',
    containedValueType: 'IssueTypeScreenScheme',
  },
  FieldConfigurationSchemeProjects: {
    containedValuePath: 'fieldConfigurationScheme.id',
    containedValueType: 'FieldConfigurationScheme',
  },
}

type ModifiedField = {
  field: Field
  newType: TypeElement
}

const isContainerValueType = (containedValueType: ContainedValueType)
  : containedValueType is ContainerValueType => !_.isString(containedValueType)


function getContainedValueType(
  typeElementByName: Record<string, TypeElement>,
  containedValueType: ContainedValueType
): TypeElement | undefined {
  const getContainedValueContainerType = (containerValueType: ContainerValueType)
    : TypeElement | undefined => {
    const innerType = getContainedValueType(typeElementByName, containerValueType.type)
    if (innerType === undefined) {
      return undefined
    }
    return containerValueType.container === 'list'
      ? new ListType(innerType)
      : new MapType(innerType)
  }

  const getContainedValueObjectType = (typeName: string): TypeElement | undefined => (
    typeElementByName[typeName] ?? BuiltinTypesByFullName[typeName]
  )
  return isContainerValueType(containedValueType)
    ? getContainedValueContainerType(containedValueType)
    : getContainedValueObjectType(containedValueType)
}


const transformFunction = async (
  typeElementByName: Record<string, TypeElement>,
  modifiedFields: ModifiedField[],
  configByTypeName: Record<string, ReplaceObjectWithContainedValueConfig>,
): Promise<TransformFunc> => async ({ field, value }) => {
  if (field === undefined) {
    return value
  }
  const fieldType = await field.getType()
  const fieldTypeName = isListType(fieldType) || isMapType(fieldType)
    ? fieldType.refInnerType.elemID.typeName
    : fieldType.elemID.typeName
  const config = configByTypeName[fieldTypeName]
  if (config === undefined) {
    return value
  }
  const containedValueType = getContainedValueType(typeElementByName, config.containedValueType)
  if (containedValueType === undefined) {
    log.warn('Contained value type not found: %s', config.containedValueType)
    return value
  }
  let newVal = value
  if (isObjectType(fieldType)) {
    if (!_.isPlainObject(value)) {
      return value
    }
    newVal = _.get(value, config.containedValuePath)
    if (newVal === undefined) {
      log.warn('Did not find value at path %s.%s', fieldTypeName, config.containedValuePath)
      // Prevents overriding types of container fields
      _.remove(modifiedFields,
        modifiedField => modifiedField.field.elemID.getFullName() === field.elemID.getFullName())
      return value
    }
  }
  modifiedFields.push({ field, newType: containedValueType })
  return newVal
}

export const replaceObjectWithContainedValue = async (
  instance: InstanceElement,
  typeElementByName: Record<string, TypeElement>,
  modifiedFields: ModifiedField[],
  configByTypeName: Record<string, ReplaceObjectWithContainedValueConfig>
): Promise<void> => {
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    strict: false,
    allowEmpty: true,
    transformFunc: await transformFunction(
      typeElementByName,
      modifiedFields,
      configByTypeName,
    ),
  }) ?? instance.value
}

const setFieldType = async (modifiedField: ModifiedField): Promise<void> => {
  const { field, newType } = modifiedField
  const fieldType = await field.getType()
  if (isMapType(fieldType)) {
    field.refType = createRefToElmWithValue(new MapType(newType))
  } else if (isListType(fieldType)) {
    field.refType = createRefToElmWithValue(new ListType(newType))
  } else {
    field.refType = createRefToElmWithValue(newType)
  }
}

/**
 * Replaces object values by type with a contained value.
 * Note: Supports List and Map types. The inner type will change to the containedValueType.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[], configByTypeName = DEFAULT_CONFIG) => {
    const modifiedFields: ModifiedField[] = []
    const typeElementByName = _.keyBy(
      elements.filter(isType),
      e => e.elemID.typeName
    )
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(instance =>
        replaceObjectWithContainedValue(
          instance,
          typeElementByName,
          modifiedFields,
          configByTypeName
        ))
    await awu(modifiedFields).forEach(setFieldType)
  },
})

export default filter
