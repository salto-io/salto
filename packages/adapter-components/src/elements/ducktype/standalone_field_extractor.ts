/*
*                      Copyright 2024 Salto Labs Ltd.
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
import { InstanceElement, isObjectType, isInstanceElement, ReferenceExpression, ObjectType, Element, createRefToElmWithValue, isListType, ListType, TypeElement, ElemIdGetter } from '@salto-io/adapter-api'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { StandaloneFieldConfigType, TransformationConfig, TransformationDefaultConfig } from '../../config'
import { generateType } from './type_elements'
import { toInstance } from './instance_elements'
import { toNestedTypeName } from '../../fetch/element'

const log = logger(module)
const { awu } = collections.asynciterable
const { makeArray } = collections.array
const { isDefined } = lowerdashValues

const convertStringToObject = (
  inst: InstanceElement,
  standaloneFields: StandaloneFieldConfigType[],
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
          if (fieldValue === 'null') {
            log.info('treating null as undefined in instance %s %s, value: %s',
              inst.elemID.getFullName(), fieldName, fieldValue)
            return undefined
          }
          // arrays are not supported yet
          log.warn('not parsing json from instance %s %s, value: %s',
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

const addFieldTypeAndInstances = async ({
  adapterName,
  typeName,
  fieldName,
  type,
  instances,
  transformationConfigByType,
  transformationDefaultConfig,
  getElemIdFunc,
}: {
  adapterName: string
  typeName: string
  fieldName: string
  type: ObjectType
  instances: InstanceElement[]
  transformationConfigByType: Record<string, TransformationConfig>
  transformationDefaultConfig: TransformationDefaultConfig
  getElemIdFunc?: ElemIdGetter
}): Promise<Element[]> => {
  if (type.fields[fieldName] === undefined) {
    log.info('type %s field %s does not exist (maybe it is not populated by any of the instances), not extracting field', type.elemID.name, fieldName)
    return []
  }
  const instancesWithValues = instances.filter(inst => inst.value[fieldName] !== undefined)
  if (!instancesWithValues.map(inst => inst.value[fieldName]).every(_.isObjectLike)) {
    log.error('not all values for type %s field %s are objects, not extracting field', type.elemID.name, fieldName)
    return []
  }

  const getInnerType = async (elem: TypeElement): Promise<TypeElement> => (
    isListType(elem)
      ? elem.getInnerType()
      : elem
  )

  const elements: Element[] = []
  const currentType = await type.fields[fieldName].getType()
  if (!isObjectType(await getInnerType(currentType))) {
    const fieldType = generateType({
      adapterName,
      name: toNestedTypeName(typeName, fieldName),
      entries: instancesWithValues.flatMap(inst => inst.value[fieldName]),
      hasDynamicFields: false,
      isSubType: true,
      transformationConfigByType,
      transformationDefaultConfig,
    })
    type.fields[fieldName].refType = isListType(currentType)
      ? createRefToElmWithValue(new ListType(fieldType.type))
      : createRefToElmWithValue(fieldType.type)
    elements.push(fieldType.type, ...fieldType.nestedTypes)
  }

  const updatedFieldType = await type.fields[fieldName].getType()
  const fieldType = await getInnerType(updatedFieldType)
  if (!isObjectType(fieldType)) {
    // should not happen
    log.warn('expected field type %s to be an object type, not extracting standalone fields', fieldType.elemID.getFullName())
    return []
  }

  await awu(instancesWithValues).forEach(async inst => {
    const fieldInstances = await awu(makeArray(inst.value[fieldName])).map(async (val, index) => {
      const fieldInstance = await toInstance({
        entry: val,
        type: fieldType,
        defaultName: `unnamed_${index}`,
        parent: inst,
        nestName: true,
        transformationConfigByType,
        transformationDefaultConfig,
        getElemIdFunc,
        nestedPath: [
          ...inst.path?.slice(2, inst.path?.length - 1) ?? [],
          fieldName,
        ],
      })
      if (fieldInstance === undefined) {
        // cannot happen
        log.error('unexpected empty nested field %s for instance %s', fieldName, inst.elemID.getFullName())
        return undefined
      }
      return fieldInstance
    }).filter(isDefined).toArray()
    const refs = fieldInstances.map(refInst => new ReferenceExpression(refInst.elemID, refInst))
    if (Array.isArray(inst.value[fieldName])) {
      inst.value[fieldName] = refs
    } else {
      // eslint-disable-next-line prefer-destructuring
      inst.value[fieldName] = refs[0]
    }
    elements.push(...fieldInstances)
  })
  return elements
}

/**
 * Extract fields marked as standalone into their own instances, and convert the original
 * value into a reference to the new instances.
 *
 * Note: modifies the elements array in-place.
 */
export const extractStandaloneFields = async ({
  elements,
  transformationConfigByType,
  transformationDefaultConfig,
  adapterName,
  getElemIdFunc,
}: {
  elements: Element[]
  transformationConfigByType: Record<string, TransformationConfig>
  transformationDefaultConfig: TransformationDefaultConfig
  adapterName: string
  getElemIdFunc?: ElemIdGetter
}): Promise<void> => {
  const allTypes = _.keyBy(elements.filter(isObjectType), e => e.elemID.name)
  const allInstancesbyType = _.groupBy(
    elements.filter(isInstanceElement),
    e => e.refType.elemID.getFullName()
  )

  const typesWithStandaloneFields = _.pickBy(
    _.mapValues(
      transformationConfigByType,
      typeDef => typeDef.standaloneFields,
    ),
    standaloneFields => !_.isEmpty(standaloneFields),
  ) as Record<string, StandaloneFieldConfigType[]>

  await awu(Object.entries(typesWithStandaloneFields))
    .forEach(async ([typeName, standaloneFields]) => {
      const type = allTypes[typeName]
      if (type === undefined) {
        return
      }
      const instances = allInstancesbyType[type.elemID.getFullName()] ?? []

      // first convert the fields to the right structure
      instances.forEach(inst => convertStringToObject(inst, standaloneFields))

      // now extract the field data to its own type and instances, and replace the original
      // value with a reference to the newly-generate instance
      await awu(standaloneFields).forEach(async fieldDef => {
        elements.push(...await addFieldTypeAndInstances({
          adapterName,
          typeName,
          fieldName: fieldDef.fieldName,
          type,
          instances,
          transformationConfigByType,
          transformationDefaultConfig,
          getElemIdFunc,
        }))
      })
    })
}
