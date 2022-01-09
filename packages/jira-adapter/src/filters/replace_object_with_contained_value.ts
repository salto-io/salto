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
  BuiltinTypesByFullName,
  ContainerType,
  createRefToElmWithValue,
  Element,
  Field,
  InstanceElement,
  isContainerType,
  isInstanceElement,
  isListType,
  isMapType,
  isObjectType,
  ListType,
  MapType,
  ObjectType,
  TypeElement,
} from '@salto-io/adapter-api'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

type ContainerFactory = (innerType: ObjectType) => ContainerType

export type ReplaceObjectWithContainedValueConfig = {
  containedValuePath: string
  containedValueType: string
  containerFactory?: ContainerFactory
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
  IssueTypeSchemeMapping: {
    containedValuePath: 'issueTypeId',
    containedValueType: 'IssueTypeDetails',
  },
}

type ModifiedField = {
  field: Field
  newType: TypeElement
}


const getContainedValueType = (
  typeByName: Record<string, ObjectType>,
  config: ReplaceObjectWithContainedValueConfig,
): TypeElement => {
  const containedValueType = typeByName[config.containedValueType]
    ?? BuiltinTypesByFullName[config.containedValueType]
  return isDefined(config.containerFactory)
    ? config.containerFactory(containedValueType)
    : containedValueType
}


const replaceObjectWithContainedValueFunction = async (
  typeByName: Record<string, ObjectType>,
  modifiedFields: ModifiedField[],
  configByTypeName: Record<string, ReplaceObjectWithContainedValueConfig>,
): Promise<TransformFunc> => async ({ field, value }) => {
  if (field === undefined) {
    return value
  }
  const fieldType = await field.getType()
  const fieldTypeName = isContainerType(fieldType)
    ? fieldType.refInnerType.elemID.typeName
    : fieldType.elemID.typeName
  const config = configByTypeName[fieldTypeName]
  if (config === undefined) {
    return value
  }
  const containedValueType = getContainedValueType(typeByName, config)
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

const replaceObjectWithContainedValue = async (
  instance: InstanceElement,
  typeByName: Record<string, ObjectType>,
  modifiedFields: ModifiedField[],
  configByTypeName: Record<string, ReplaceObjectWithContainedValueConfig>
): Promise<void> => {
  instance.value = await transformValues({
    values: instance.value,
    type: await instance.getType(),
    strict: false,
    allowEmpty: true,
    transformFunc: await replaceObjectWithContainedValueFunction(
      typeByName,
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
 * Notes:
 * ------
 * - Should only be used on non deployable types, to avoid deploy problems.
 * - Supports List and Map types. The inner type will change to the containedValueType.
 */
const filter: FilterCreator = () => ({
  onFetch: async (elements: Element[], configByTypeName = DEFAULT_CONFIG) => {
    const modifiedFields: ModifiedField[] = []
    const typeByName = _.keyBy(
      elements.filter(isObjectType),
      e => e.elemID.typeName
    )
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(instance =>
        replaceObjectWithContainedValue(
          instance,
          typeByName,
          modifiedFields,
          configByTypeName
        ))
    await awu(modifiedFields).forEach(setFieldType)
  },
})

export default filter
