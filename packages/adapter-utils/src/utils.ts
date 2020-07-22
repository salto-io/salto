/*
*                      Copyright 2020 Salto Labs Ltd.
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
import wu from 'wu'
import _ from 'lodash'
import safeStringify from 'fast-safe-stringify'
import { logger } from '@salto-io/logging'
import {
  ObjectType, isStaticFile, StaticFile, ElemID, PrimitiveType, Values, Value, isReferenceExpression,
  Element, isInstanceElement, InstanceElement, isPrimitiveType, TypeMap, isField,
  ReferenceExpression, Field, InstanceAnnotationTypes, isType, isObjectType, isListType,
  CORE_ANNOTATIONS, TypeElement,
} from '@salto-io/adapter-api'
import { promises, values as lowerDashValues } from '@salto-io/lowerdash'

const { mapValuesAsync } = promises.object
const { isDefined } = lowerDashValues

const log = logger(module)

export const naclCase = (name?: string): string => (
  // unescape changes HTML escaped parts (&gt; for example), then the regex
  // replaces url escaped chars as well as any special character to keep names Nacl files friendly
  // Match multiple consecutive chars to compact names and avoid repeated _
  name ? _.unescape(name).replace(/((%[0-9A-F]{2})|[^\w\d])+/g, '_') : ''
)

export type TransformFuncArgs = {
  value: Value
  path?: ElemID
  field?: Field
}
export type TransformFunc = (args: TransformFuncArgs) => Value | undefined

export const transformValues = (
  {
    values,
    type,
    transformFunc,
    strict = true,
    pathID = undefined,
    isTopLevel = true,
  }: {
    values: Value
    type: ObjectType | TypeMap
    transformFunc: TransformFunc
    strict?: boolean
    pathID?: ElemID
    isTopLevel?: boolean
  }
): Values | undefined => {
  const transformValue = (value: Value, keyPathID?: ElemID, field?: Field): Value => {
    if (field === undefined) {
      return strict ? undefined : transformFunc({ value, path: keyPathID })
    }

    if (isReferenceExpression(value)) {
      return transformFunc({ value, path: keyPathID, field })
    }

    const newVal = transformFunc({ value, path: keyPathID, field })
    if (newVal === undefined) {
      return undefined
    }

    const fieldType = field.type

    if (isListType(fieldType)) {
      const transformListInnerValue = (item: Value, index?: number): Value =>
        (transformValue(
          item,
          !_.isUndefined(index) ? keyPathID?.createNestedID(String(index)) : keyPathID,
          new Field(
            field.parent,
            field.name,
            fieldType.innerType,
            field.annotations
          ),
        ))
      if (!_.isArray(newVal)) {
        if (strict) {
          log.warn(`Array value and isListType mis-match for field - ${field.name}. Got non-array for ListType.`)
        }
        return transformListInnerValue(newVal)
      }
      const transformed = newVal
        .map(transformListInnerValue)
        .filter((val: Value) => !_.isUndefined(val))
      return transformed.length === 0 ? undefined : transformed
    }
    // It shouldn't get here because only ListType should have array values
    if (_.isArray(newVal)) {
      if (strict) {
        log.warn(`Array value and isListType mis-match for field - ${field.name}. Only ListTypes should have array values.`)
      }
      const transformed = newVal
        .map((item, index) => transformValue(item, keyPathID?.createNestedID(String(index)), field))
        .filter(val => !_.isUndefined(val))
      return transformed.length === 0 ? undefined : transformed
    }

    if (isObjectType(fieldType)) {
      const transformed = _.omitBy(
        transformValues({
          values: newVal,
          type: fieldType,
          transformFunc,
          strict,
          pathID: keyPathID,
          isTopLevel: false,
        }),
        _.isUndefined
      )
      return _.isEmpty(transformed) ? undefined : transformed
    }
    return newVal
  }

  const fieldMap = isObjectType(type)
    ? type.fields
    : _.mapValues(
      type,
      (fieldType, name) => new Field(new ObjectType({ elemID: new ElemID('') }), name, fieldType),
    )

  const newVal = isTopLevel ? transformFunc({ value: values, path: pathID }) : values
  const result = _(newVal)
    .mapValues((value, key) => transformValue(value, pathID?.createNestedID(key), fieldMap[key]))
    .omitBy(_.isUndefined)
    .value()
  return _.isEmpty(result) ? undefined : result
}

export const transformElement = <T extends Element>(
  {
    element,
    transformFunc,
    strict,
  }: {
    element: T
    transformFunc: TransformFunc
    strict?: boolean
  }
): T => {
  let newElement: Element

  const elementAnnotationTypes = (): TypeMap => {
    if (isInstanceElement(element)) {
      return InstanceAnnotationTypes
    }

    if (isField(element)) {
      return element.type.annotationTypes
    }

    return element.annotationTypes
  }

  const transformedAnnotations = transformValues({
    values: element.annotations,
    type: elementAnnotationTypes(),
    transformFunc,
    strict,
    pathID: isType(element) ? element.elemID.createNestedID('attr') : element.elemID,
  }) || {}

  if (isInstanceElement(element)) {
    const transformedValues = transformValues({
      values: element.value,
      type: element.type,
      transformFunc,
      strict,
      pathID: element.elemID,
    }) || {}

    newElement = new InstanceElement(
      element.elemID.name,
      element.type,
      transformedValues,
      element.path,
      transformedAnnotations
    )
    return newElement as T
  }

  if (isObjectType(element)) {
    const clonedFields = _.mapValues(
      element.fields,
      field => transformElement(
        {
          element: field,
          transformFunc,
          strict,
        }
      )
    )

    newElement = new ObjectType({
      elemID: element.elemID,
      fields: clonedFields,
      annotationTypes: element.annotationTypes,
      annotations: transformedAnnotations,
      path: element.path,
      isSettings: element.isSettings,
    })

    return newElement as T
  }

  if (isField(element)) {
    newElement = new Field(
      element.parent,
      element.name,
      element.type,
      transformedAnnotations,
    )
    return newElement as T
  }

  if (isPrimitiveType(element)) {
    newElement = new PrimitiveType({
      elemID: element.elemID,
      primitive: element.primitive,
      annotationTypes: element.annotationTypes,
      path: element.path,
      annotations: transformedAnnotations,
    })

    return newElement as T
  }

  throw Error('received unsupported (subtype) Element')
}

export type GetLookupNameFuncArgs = {
  ref: ReferenceExpression
  field?: Field
  path?: ElemID
}
export type GetLookupNameFunc = (args: GetLookupNameFuncArgs) => Value

export const resolveValues = <T extends Element>(element: T, getLookUpName: GetLookupNameFunc):
  T => {
  const valuesReplacer: TransformFunc = ({ value, field, path }) => {
    if (isReferenceExpression(value)) {
      return getLookUpName({
        ref: value,
        field,
        path,
      })
    }
    if (isStaticFile(value)) {
      return value.content?.toString()
    }
    return value
  }

  return transformElement({
    element,
    transformFunc: valuesReplacer,
    strict: false,
  })
}

export const restoreValues = <T extends Element>(
  source: T,
  targetElement: T,
  getLookUpName: GetLookupNameFunc
): T => {
  const allReferencesPaths = new Map<string, ReferenceExpression>()
  const allStaticFilesPaths = new Map<string, StaticFile>()
  const createPathMapCallback: TransformFunc = ({ value, path }) => {
    if (path && isReferenceExpression(value)) {
      allReferencesPaths.set(path.getFullName(), value)
    }
    if (path && isStaticFile(value)) {
      allStaticFilesPaths.set(path.getFullName(), value)
    }
    return value
  }

  transformElement({
    element: source,
    transformFunc: createPathMapCallback,
    strict: false,
  })

  const restoreValuesFunc: TransformFunc = ({ value, field, path }) => {
    if (path === undefined) {
      return value
    }

    const ref = allReferencesPaths.get(path.getFullName())
    if (ref !== undefined
      && _.isEqual(getLookUpName({ ref, field, path }), value)) {
      return ref
    }
    const file = allStaticFilesPaths.get(path.getFullName())
    if (!_.isUndefined(file)) {
      return new StaticFile({ filepath: file.filepath, content: Buffer.from(value) })
    }

    return value
  }

  return transformElement({
    element: targetElement,
    transformFunc: restoreValuesFunc,
    strict: false,
  })
}

export const findElements = (elements: Iterable<Element>, id: ElemID): Iterable<Element> => (
  wu(elements).filter(e => e.elemID.isEqual(id))
)

export const findElement = (elements: Iterable<Element>, id: ElemID): Element | undefined => (
  wu(elements).find(e => e.elemID.isEqual(id))
)

export const findObjectType = (elements: Iterable<Element>, id: ElemID): ObjectType | undefined => {
  const objects = wu(elements).filter(isObjectType) as wu.WuIterable<ObjectType>
  return objects.find(e => e.elemID.isEqual(id))
}

export const findInstances = (
  elements: Iterable<Element>,
  typeID: ElemID,
): Iterable<InstanceElement> => {
  const instances = wu(elements).filter(isInstanceElement) as wu.WuIterable<InstanceElement>
  return instances.filter(e => e.type.elemID.isEqual(typeID))
}

const getPath = (
  rootElement: Element,
  fullElemID: ElemID
): string[] | undefined => {
  const { parent, path } = fullElemID.createTopLevelParentID()
  if (!_.isEqual(parent, rootElement.elemID)) return undefined
  if (_.isEmpty(path)) return []
  if (isInstanceElement(rootElement) && fullElemID.idType === 'instance') {
    return ['value', ...path]
  }

  if (isObjectType(rootElement) && fullElemID.idType === 'field') {
    const fieldName = path[0]
    const fieldAnnoPath = path.slice(1)
    if (_.isEmpty(fieldAnnoPath)) return ['fields', fieldName]
    return ['fields', fieldName, 'annotations', ...fieldAnnoPath]
  }

  if (isType(rootElement) && fullElemID.idType === 'attr') {
    return ['annotations', ...path]
  }

  if (isType(rootElement) && fullElemID.idType === 'annotation') {
    const annoTypeName = path[0]
    const annoTypePath = path.slice(1)
    if (_.isEmpty(annoTypePath)) return ['annotationTypes', annoTypeName]
    return ['annotationTypes', annoTypeName, 'annotations', ...annoTypePath]
  }
  return undefined
}


export const setPath = (rootElement: Element, fullElemID: ElemID, value: Value): void => {
  const path = getPath(rootElement, fullElemID)
  if (_.isUndefined(path)) {
    log.warn('Failed to set: rootElement is not parent of fullElemID')
    return
  }
  if (_.isEmpty(path)) {
    log.warn('Failed to set: can not set the whole Element')
    return
  }
  if (value === undefined) {
    _.unset(rootElement, path)
  } else {
    _.set(rootElement, path, value)
  }
}

export const resolvePath = (rootElement: Element, fullElemID: ElemID): Value => {
  const path = getPath(rootElement, fullElemID)
  if (_.isUndefined(path)) return undefined
  if (_.isEmpty(path)) return rootElement
  return _.get(rootElement, path)
}

const flatStr = (str: string): string => `${Buffer.from(str).toString()}`

export const flatValues = (values: Value): Value => {
  if (_.isString(values)) {
    return flatStr(values)
  }
  if (_.isArray(values)) {
    return values.map(flatValues)
  }
  if (isStaticFile(values)) {
    return values
  }
  if (_.isPlainObject(values)) {
    return _.reduce(_.keys(values), (acc, k) => {
      acc[flatStr(k)] = flatValues(values[k])
      return acc
    }, {} as Record<string, Value>)
  }
  return values
}

// This method solves a memory leak which takes place when we use slices
// from a large string in order to populate the strings in the elements.
// v8 will attempt to optimize the slicing operation by internally representing
// the slices string as a pointer to the large string with a start and finish indexes
// for the slice. As a result - the original string will not be evacuated from memory.
// to solve this we need to force v8 to change the sliced string representation to a
// regular string. We need to perform this operation for *every* string the elements
// including object keys.
export const flattenElementStr = (element: Element): Element => {
  const flattenField = (field: Field): Field => new Field(
    field.parent,
    flatStr(field.name),
    field.type,
    flatValues(field.annotations),
  )

  const flattenObjectType = (obj: ObjectType): ObjectType => new ObjectType({
    elemID: obj.elemID,
    annotationTypes: _(obj.annotationTypes).mapKeys((_v, k) => flatStr(k)).value(),
    annotations: flatValues(obj.annotations),
    fields: _(obj.fields).mapKeys((_v, k) => flatStr(k)).mapValues(flattenField).value(),
    isSettings: obj.isSettings,
    path: obj.path?.map(flatStr),
  })

  const flattenPrimitiveType = (prim: PrimitiveType): PrimitiveType => new PrimitiveType({
    elemID: prim.elemID,
    primitive: prim.primitive,
    annotationTypes: _.mapKeys(prim.annotationTypes, (_v, k) => flatStr(k)),
    annotations: flatValues(prim.annotations),
    path: prim.path?.map(flatStr),
  })

  const flattenInstance = (inst: InstanceElement): InstanceElement => new InstanceElement(
    flatStr(inst.elemID.name),
    inst.type,
    flatValues(inst.value),
    inst.path?.map(flatStr),
    flatValues(inst.annotations)
  )

  if (isField(element)) return flattenField(element)
  if (isObjectType(element)) return flattenObjectType(element)
  if (isPrimitiveType(element)) return flattenPrimitiveType(element)
  if (isInstanceElement(element)) return flattenInstance(element)
  return element
}

// This method is similar to lodash and Array's `some` method, except that it runs deep on
// a Values object
export const valuesDeepSome = (value: Value, predicate: (val: Value) => boolean): boolean => {
  if (predicate(value)) {
    return true
  }
  if (_.isArray(value)) {
    return value.some(x => valuesDeepSome(x, predicate))
  }
  if (_.isObject(value)) {
    return _.values(value).some(x => valuesDeepSome(x, predicate))
  }
  return false
}

export const filterByID = async <T>(
  id: ElemID, value: T,
  filterFunc: (id: ElemID) => Promise<boolean>
): Promise<T | undefined> => {
  const filterAnnotations = async (annotations: Value): Promise<Value> => (
    filterByID(id.createNestedID('attr'), annotations, filterFunc)
  )

  const filterAnnotationType = async (annoTypes: TypeMap): Promise<TypeMap> => _.pickBy(
    await mapValuesAsync(annoTypes, async (anno, annoName) => (
      await filterFunc(id.createNestedID('annotation').createNestedID(annoName)) ? anno : undefined
    )),
    anno => anno !== undefined
  ) as TypeMap

  if (!await filterFunc(id)) {
    return undefined
  }
  if (isObjectType(value)) {
    const filteredFields = await Promise.all(
      Object.values(value.fields).map(field => filterByID(field.elemID, field, filterFunc))
    )
    return new ObjectType({
      elemID: value.elemID,
      annotations: await filterAnnotations(value.annotations),
      annotationTypes: await filterAnnotationType(value.annotationTypes),
      fields: _.keyBy(filteredFields.filter(isDefined), field => field.name),
      path: value.path,
      isSettings: value.isSettings,
    }) as Value as T
  }
  if (isPrimitiveType(value)) {
    return new PrimitiveType({
      elemID: value.elemID,
      annotations: await filterAnnotations(value.annotations),
      annotationTypes: await filterAnnotationType(value.annotationTypes),
      primitive: value.primitive,
      path: value.path,
    }) as Value as T
  }
  if (isField(value)) {
    return new Field(
      value.parent,
      value.name,
      value.type,
      await filterByID(value.elemID, value.annotations, filterFunc)
    ) as Value as T
  }
  if (isInstanceElement(value)) {
    return new InstanceElement(
      value.elemID.name,
      value.type,
      await filterByID(value.elemID, value.value, filterFunc),
      value.path,
      await filterAnnotations(value.annotations)
    ) as Value as T
  }

  if (_.isPlainObject(value)) {
    const filteredObj = _.pickBy(
      await mapValuesAsync(
        value,
        async (val: Value, key: string) => filterByID(id.createNestedID(key), val, filterFunc)
      ),
      val => val !== undefined
    )
    return _.isEmpty(filteredObj) ? undefined : filteredObj as Value as T
  }
  if (_.isArray(value)) {
    const filteredArray = (await (Promise.all(value.map(
      async (item, i) => filterByID(id.createNestedID(i.toString()), item, filterFunc)
    )))).filter(item => item !== undefined)
    return _.isEmpty(filteredArray) ? undefined : filteredArray as Value as T
  }

  return value
}

// This method iterate on types and corresponding values and run innerChange
// on every "node".
// This method DOESN'T SUPPORT list of lists!
export const applyRecursive = (type: ObjectType, value: Values,
  innerChange: (field: Field, value: Value) => Value): void => {
  if (!value) return
  Object.keys(type.fields).forEach(key => {
    if (value[key] === undefined) return
    value[key] = innerChange(type.fields[key], value[key])
    const fieldType = type.fields[key].type
    if (!isListType(fieldType) && !isObjectType(fieldType)) return
    const actualFieldType = isListType(fieldType) ? fieldType.innerType : fieldType
    if (isObjectType(actualFieldType)) {
      if (_.isArray(value[key])) {
        value[key].forEach((val: Values) => applyRecursive(actualFieldType, val, innerChange))
      } else {
        applyRecursive(actualFieldType, value[key], innerChange)
      }
    }
  })
}

type MapKeysRecursiveArgs = {
  key: string
  pathID?: ElemID
}

export type MapKeyFunc = (args: MapKeysRecursiveArgs) => string

export const mapKeysRecursive = (obj: Values, func: MapKeyFunc, pathID?: ElemID): Values => {
  if (_.isArray(obj)) {
    return obj.map((val, idx) => mapKeysRecursive(val, func, pathID?.createNestedID(String(idx))))
  }
  if (_.isPlainObject(obj)) {
    return _(obj)
      .mapKeys((_val, key) => func({ key, pathID: pathID?.createNestedID(String(key)) }))
      .mapValues((val, key) => mapKeysRecursive(val, func, pathID?.createNestedID(String(key))))
      .value()
  }
  return obj
}

const mergeWithDefaults = (type: TypeElement, values: Values): Values => {
  const mergeWithObjectDefaults = (object: ObjectType, innerValues: Values): Values =>
    _(object.fields).mapValues((field, name) => {
      if (field.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined && !isListType(field.type)) {
        return field.type.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined
          ? innerValues[name]
          : mergeWithDefaults(field.type, innerValues[name])
      }
      return innerValues[name] ?? field.annotations[CORE_ANNOTATIONS.DEFAULT]
    }).pickBy(v => v !== undefined).value()

  return (type.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined && isObjectType(type)
    ? mergeWithObjectDefaults(type, values)
    : (values ?? type.annotations[CORE_ANNOTATIONS.DEFAULT]))
}

export const applyInstancesDefaults = (instances: InstanceElement[]): void => {
  instances
    .forEach(inst => {
      const valueWithDefaults = mergeWithDefaults(inst.type, inst.value)
      if (!_.isEmpty(valueWithDefaults)) {
        inst.value = valueWithDefaults
      }
    })
}

export const createDefaultInstanceFromType = (name: string, objectType: ObjectType):
  InstanceElement => {
  const instance = new InstanceElement(name, objectType)
  applyInstancesDefaults([instance])
  return instance
}

export const safeJsonStringify = (value: Value): string => safeStringify(value)
