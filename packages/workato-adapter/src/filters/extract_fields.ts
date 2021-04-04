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
  InstanceElement, isObjectType, isInstanceElement, ReferenceExpression, ObjectType,
  Element,
} from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { WORKATO } from '../constants'
import { FilterCreator } from '../filter'
import { API_DEFINITIONS_CONFIG } from '../config'

const log = logger(module)
const { isDefined } = lowerdashValues
const { generateType, toInstance, toNestedTypeName } = elementUtils.ducktype

const convertStringToObject = (
  inst: InstanceElement,
  standaloneFields: configUtils.StandaloneFieldConfigType[],
): void => {
  const fieldsByPath = _.keyBy(standaloneFields, ({ fieldName }) => fieldName)
  inst.value = _.mapValues(inst.value, (fieldValue, fieldName) => {
    const standaloneFieldDef = fieldsByPath[fieldName]
    if (standaloneFieldDef !== undefined) {
      try {
        const shouldParseJson = _.isString(fieldValue) && standaloneFieldDef.parseJSON
        if (shouldParseJson) {
          if (fieldValue.startsWith('{')) {
            return JSON.parse(fieldValue)
          }
          // arrays are not supported yet
          log.warn('not parsing json from inst %s %s, value: %s',
            inst.elemID.getFullName(), fieldName, fieldValue)
        }
        return fieldValue
      } catch (e) {
        log.error('failed to convert field %s to JSON. Error: %s, value: %o, stack: %o',
          fieldName, e, fieldValue, e.stack)
      }
    }
    return fieldValue
  })
}

const addFieldTypeAndInstances = ({
  typeName,
  fieldName,
  type,
  instances,
  transformationConfigByType,
  transformationDefaultConfig,
}: {
  typeName: string
  fieldName: string
  type: ObjectType
  instances: InstanceElement[]
  transformationConfigByType: Record<string, configUtils.TransformationConfig>
  transformationDefaultConfig: configUtils.TransformationDefaultConfig
}): Element[] => {
  if (type.fields[fieldName] === undefined) {
    log.info('type %s field %s does not exist (maybe it is not populated by any of the instances), not extracting field', type.elemID.name, fieldName)
    return []
  }
  const instancesWithValues = instances.filter(inst => inst.value[fieldName] !== undefined)
  if (!instancesWithValues.map(inst => inst.value[fieldName]).every(_.isObjectLike)) {
    log.error('not all values for type %s field %s are objects, not extracting field', type.elemID.name, fieldName)
    return []
  }

  const elements: Element[] = []
  const fieldType = generateType({
    adapterName: WORKATO,
    name: toNestedTypeName(typeName, fieldName),
    entries: instancesWithValues.map(inst => inst.value[fieldName]),
    hasDynamicFields: false,
    isSubType: true,
  })
  type.fields[fieldName].type = fieldType.type
  elements.push(fieldType.type, ...fieldType.nestedTypes)

  instancesWithValues.forEach(inst => {
    const fieldInstance = toInstance({
      entry: inst.value[fieldName],
      type: fieldType.type,
      defaultName: 'unnamed',
      parent: inst,
      nestName: true,
      transformationConfigByType,
      transformationDefaultConfig,
    })
    if (fieldInstance === undefined) {
      // cannot happen
      log.error('unexpected empty nested field %s for instance %s', fieldName, inst.elemID.getFullName())
      return
    }
    inst.value[fieldName] = new ReferenceExpression(fieldInstance.elemID)
    elements.push(fieldInstance)
  })
  return elements
}

const extractFields = ({
  elements,
  transformationConfigByType,
  transformationDefaultConfig,
}: {
  elements: Element[]
  transformationConfigByType: Record<string, configUtils.TransformationConfig>
  transformationDefaultConfig: configUtils.TransformationDefaultConfig
}): Element[] => {
  const allTypes = _.keyBy(elements.filter(isObjectType), e => e.elemID.name)
  const allInstancesbyType = _.groupBy(
    elements.filter(isInstanceElement),
    e => e.type.elemID.getFullName()
  )

  const newElements: Element[] = []

  const typesWithStandaloneFields = _.pickBy(
    _.mapValues(
      transformationConfigByType,
      typeDef => typeDef.standaloneFields,
    ),
    standaloneFields => !_.isEmpty(standaloneFields),
  ) as Record<string, configUtils.StandaloneFieldConfigType[]>

  Object.entries(typesWithStandaloneFields).forEach(([typeName, standaloneFields]) => {
    const type = allTypes[typeName]
    if (type === undefined) {
      log.error('could not find type %s', typeName)
      return
    }
    const instances = allInstancesbyType[type.elemID.getFullName()] ?? []

    // first convert the fields to the right structure
    instances.forEach(inst => convertStringToObject(inst, standaloneFields))

    // now extract the field data to its own type and instances, and replace the original
    // value with a reference to the newly-generate instance
    standaloneFields.forEach(fieldDef => {
      newElements.push(...addFieldTypeAndInstances({
        typeName,
        fieldName: fieldDef.fieldName,
        type,
        instances,
        transformationConfigByType,
        transformationDefaultConfig,
      }))
    })
  })
  return newElements
}

/**
 * Extract fields to their own types based on the configuration.
 * For each of these fields, extract the values into separate instances and convert the values
 * into reference expressions.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async elements => {
    const transformationConfigByType = _.pickBy(
      _.mapValues(config[API_DEFINITIONS_CONFIG].types, def => def.transformation),
      isDefined,
    )
    const transformationDefaultConfig = config[API_DEFINITIONS_CONFIG].typeDefaults.transformation

    const allNewElements = extractFields({
      elements,
      transformationConfigByType,
      transformationDefaultConfig,
    }).flat()
    elements.push(...allNewElements)
  },
})

export default filter
