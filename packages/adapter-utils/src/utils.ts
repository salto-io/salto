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
import { collections, values as lowerDashValues } from '@salto-io/lowerdash'
import {
  ObjectType, isStaticFile, StaticFile, ElemID, PrimitiveType, Values, Value, isReferenceExpression,
  Element, isInstanceElement, InstanceElement, isPrimitiveType, TypeMap, isField, ChangeDataType,
  ReferenceExpression, Field, InstanceAnnotationTypes, isType, isObjectType, isAdditionChange,
  CORE_ANNOTATIONS, TypeElement, Change, isRemovalChange, isModificationChange, isListType,
  ChangeData, ListType, CoreAnnotationTypes, isMapType, MapType, isContainerType,
  INSTANCE_ANNOTATIONS, ElementsSource, ReferenceMap,
} from '@salto-io/adapter-api'

const { isDefined } = lowerDashValues

const log = logger(module)

export const applyFunctionToChangeData = <T extends Change<unknown>>(
  change: T, func: (arg: ChangeData<T>) => ChangeData<T>,
): T => {
  if (isAdditionChange(change)) {
    return { ...change, data: { after: func(change.data.after) } }
  }
  if (isRemovalChange(change)) {
    return { ...change, data: { before: func(change.data.before) } }
  }
  if (isModificationChange(change)) {
    return {
      ...change,
      data: {
        before: func(change.data.before),
        after: func(change.data.after),
      },
    }
  }
  return change
}

export const createRefToElmWithValue = (element: Element): ReferenceExpression =>
  (new ReferenceExpression(element.elemID, element))

/**
 * Generate synthetic object types for validating / transforming map type values.
 *
 * @param type    The map type for determining the field types
 * @param value   The map instance for determining the field names
 */
export const toObjectType = (type: MapType | ObjectType, value: Values): ObjectType => (
  isObjectType(type)
    ? type
    : new ObjectType({
      elemID: type.elemID,
      fields: Object.fromEntries(Object.keys(value).map(key =>
        [
          key,
          { refType: type.refInnerType },
        ])),
      annotationRefsOrTypes: type.annotationRefTypes,
      annotations: type.annotations,
      path: type.path,
    })
)

type FieldMapperFunc = (key: string) => Field | undefined

const fieldMapperGenerator = (
  type: ObjectType | TypeMap | MapType,
  value: Values,
): FieldMapperFunc => {
  if (isObjectType(type) || isMapType(type)) {
    const objType = toObjectType(type, value)
    return name => objType.fields[name]
  }
  const objType = new ObjectType({ elemID: new ElemID('') })
  return name => (type[name] !== undefined ? new Field(objType, name, type[name]) : undefined)
}

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
    type: ObjectType | TypeMap | MapType
    transformFunc: TransformFunc
    strict?: boolean
    pathID?: ElemID
    isTopLevel?: boolean
  }
): Values | undefined => {
  const transformValue = (value: Value, keyPathID?: ElemID, field?: Field): Value => {
    if (field === undefined && strict) {
      return undefined
    }

    if (isReferenceExpression(value)) {
      return transformFunc({ value, path: keyPathID, field })
    }

    const newVal = transformFunc({ value, path: keyPathID, field })
    if (newVal === undefined) {
      return undefined
    }

    if (isReferenceExpression(newVal)) {
      return newVal
    }

    const fieldType = field?.getType() // TODO: Add elementsSource

    if (field && isListType(fieldType)) {
      const transformListInnerValue = (item: Value, index?: number): Value =>
        (transformValue(
          item,
          !_.isUndefined(index) ? keyPathID?.createNestedID(String(index)) : keyPathID,
          new Field(
            field.parent,
            field.name,
            fieldType.refInnerType,
            field.annotations
          ),
        ))
      if (!_.isArray(newVal)) {
        if (strict) {
          log.debug(`Array value and isListType mis-match for field - ${field.name}. Got non-array for ListType.`)
        }
        return transformListInnerValue(newVal)
      }
      const transformed = newVal
        .map(transformListInnerValue)
        .filter((val: Value) => !_.isUndefined(val))
      return transformed.length === 0 ? undefined : transformed
    }
    if (_.isArray(newVal)) {
      // Even fields that are not defined as ListType can have array values
      const transformed = newVal
        .map((item, index) => transformValue(item, keyPathID?.createNestedID(String(index)), field))
        .filter(val => !_.isUndefined(val))
      return transformed.length === 0 ? undefined : transformed
    }

    if (isObjectType(fieldType) || isMapType(fieldType)) {
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
    if (_.isPlainObject(newVal) && !strict) {
      const transformed = _.omitBy(
        _.mapValues(
          newVal,
          (val, key) => transformValue(val, keyPathID?.createNestedID(key)),
        ),
        _.isUndefined,
      )
      return _.isEmpty(transformed) ? undefined : transformed
    }
    return newVal
  }

  const fieldMapper = fieldMapperGenerator(type, values)

  const newVal = isTopLevel ? transformFunc({ value: values, path: pathID }) : values
  const result = _(newVal)
    .mapValues((value, key) => transformValue(value, pathID?.createNestedID(key), fieldMapper(key)))
    .omitBy(_.isUndefined)
    .value()
  return _.isEmpty(result) ? undefined : result
}

export const transformElementAnnotations = <T extends Element>(
  {
    element,
    transformFunc,
    strict,
    elementsSource,
  }: {
    element: T
    transformFunc: TransformFunc
    strict?: boolean
    elementsSource?: ElementsSource
  }
): Values => {
  const elementAnnotationTypes = (): TypeMap => {
    if (isInstanceElement(element)) {
      return InstanceAnnotationTypes
    }

    return {
      ...InstanceAnnotationTypes,
      ...CoreAnnotationTypes,
      ...(isField(element)
        ? element.getType(elementsSource).getAnnotationTypes(elementsSource)
        : element.getAnnotationTypes(elementsSource)),
    }
  }

  return transformValues({
    values: element.annotations,
    type: elementAnnotationTypes(),
    transformFunc,
    strict,
    pathID: isType(element) ? element.elemID.createNestedID('attr') : element.elemID,
  }) || {}
}

export const transformElement = <T extends Element>(
  {
    element,
    transformFunc,
    strict,
    elementsSource,
  }: {
    element: T
    transformFunc: TransformFunc
    strict?: boolean
    elementsSource?: ElementsSource
  }
): T => {
  let newElement: Element

  const transformedAnnotations = transformElementAnnotations({ element, transformFunc, strict })

  if (isInstanceElement(element)) {
    const transformedValues = transformValues({
      values: element.value,
      type: element.getType(elementsSource),
      transformFunc,
      strict,
      pathID: element.elemID,
    }) || {}

    newElement = new InstanceElement(
      element.elemID.name,
      element.refType,
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
      annotationRefsOrTypes: element.annotationRefTypes,
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
      element.getType(elementsSource),
      transformedAnnotations,
    )
    return newElement as T
  }

  if (isPrimitiveType(element)) {
    newElement = new PrimitiveType({
      elemID: element.elemID,
      primitive: element.primitive,
      annotationRefsOrTypes: element.annotationRefTypes,
      path: element.path,
      annotations: transformedAnnotations,
    })

    return newElement as T
  }

  if (isListType(element)) {
    newElement = new ListType(
      transformElement({ element: element.getInnerType(elementsSource), transformFunc, strict })
    )
    return newElement as T
  }

  if (isMapType(element)) {
    newElement = new MapType(
      transformElement({ element: element.getInnerType(elementsSource), transformFunc, strict })
    )
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

export type ResolveValuesFunc = <T extends Element>(
  element: T,
  getLookUpName: GetLookupNameFunc
) => T

export const resolveValues: ResolveValuesFunc = (element, getLookUpName) => {
  const valuesReplacer: TransformFunc = ({ value, field, path }) => {
    if (isReferenceExpression(value)) {
      return getLookUpName({
        ref: value,
        field,
        path,
      })
    }
    if (isStaticFile(value)) {
      return value.encoding === 'binary'
        ? value.content : value.content?.toString(value.encoding)
    }
    return value
  }

  return transformElement({
    element,
    transformFunc: valuesReplacer,
    strict: false,
  })
}

export type RestoreValuesFunc = <T extends Element>(
  source: T,
  targetElement: T,
  getLookUpName: GetLookupNameFunc
) => T

export const restoreValues: RestoreValuesFunc = (source, targetElement, getLookUpName) => {
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
      const content = file.encoding === 'binary'
        ? value : Buffer.from(value, file.encoding)
      return new StaticFile({ filepath: file.filepath, content, encoding: file.encoding })
    }

    return value
  }

  return transformElement({
    element: targetElement,
    transformFunc: restoreValuesFunc,
    strict: false,
  })
}

export const restoreChangeElement = (
  change: Change,
  sourceElements: Record<string, ChangeDataType>,
  getLookUpName: GetLookupNameFunc,
  restoreValuesFunc = restoreValues,
): Change => applyFunctionToChangeData(
  change,
  changeData => restoreValuesFunc(
    sourceElements[changeData.elemID.getFullName()], changeData, getLookUpName,
  )
)

export const resolveChangeElement = (
  change: Change,
  getLookUpName: GetLookupNameFunc,
  resolveValuesFunc = resolveValues,
): Change => applyFunctionToChangeData(
  change,
  changeData => resolveValuesFunc(changeData, getLookUpName)
)

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
  return instances.filter(e => e.refType.elemID.isEqual(typeID))
}

export const getPath = (
  rootElement: Element,
  fullElemID: ElemID
): string[] | undefined => {
  const { parent, path } = fullElemID.createTopLevelParentID()
  if (!_.isEqual(parent, rootElement.elemID)) return undefined
  if (_.isEmpty(path)) return []
  if (fullElemID.isAttrID()) {
    return ['annotations', ...path]
  }
  if (isInstanceElement(rootElement) && fullElemID.idType === 'instance') {
    return ['value', ...path]
  }

  if (isObjectType(rootElement) && fullElemID.idType === 'field') {
    const fieldName = path[0]
    const fieldAnnoPath = path.slice(1)
    if (_.isEmpty(fieldAnnoPath)) return ['fields', fieldName]
    return ['fields', fieldName, 'annotations', ...fieldAnnoPath]
  }

  if (isType(rootElement) && fullElemID.idType === 'annotation') {
    const annoTypeName = path[0]
    const annoTypePath = path.slice(1)
    if (_.isEmpty(annoTypePath)) return ['annotationRefTypes', annoTypeName]
    return ['annotationRefTypes', annoTypeName, 'annotations', ...annoTypePath]
  }
  return undefined
}

export const setPath = (rootElement: Element, fullElemID: ElemID, value: Value): void => {
  const path = getPath(rootElement, fullElemID)
  if (path === undefined) {
    log.warn(`Failed to set: ${rootElement.elemID.getFullName()} is not parent of ${fullElemID.getFullName()}`)
    return
  }
  if (_.isEmpty(path)) {
    log.warn(`Failed to set: can not set the whole Element - ${rootElement.elemID.getFullName()}`)
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
  if (path === undefined) return undefined
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
    field.refType,
    flatValues(field.annotations),
  )

  const flattenObjectType = (obj: ObjectType): ObjectType => new ObjectType({
    elemID: obj.elemID,
    annotationRefsOrTypes: _(obj.annotationRefTypes).mapKeys((_v, k) => flatStr(k)).value(),
    annotations: flatValues(obj.annotations),
    fields: _(obj.fields).mapKeys((_v, k) => flatStr(k)).mapValues(flattenField).value(),
    isSettings: obj.isSettings,
    path: obj.path?.map(flatStr),
  })

  const flattenPrimitiveType = (prim: PrimitiveType): PrimitiveType => new PrimitiveType({
    elemID: prim.elemID,
    primitive: prim.primitive,
    annotationRefsOrTypes: _.mapKeys(prim.annotationRefTypes, (_v, k) => flatStr(k)),
    annotations: flatValues(prim.annotations),
    path: prim.path?.map(flatStr),
  })

  const flattenInstance = (inst: InstanceElement): InstanceElement => new InstanceElement(
    flatStr(inst.elemID.name),
    inst.refType,
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

export const filterByID = <T extends Element | Values>(
  id: ElemID, value: T,
  filterFunc: (id: ElemID) => boolean
): T | undefined => {
  const filterInstanceAnnotations = (annotations: Value): Value => (
    filterByID(id, annotations, filterFunc)
  )

  const filterAnnotations = (annotations: Value): Value => (
    filterByID(id.createNestedID('attr'), annotations, filterFunc)
  )

  const filterAnnotationType = (annoRefTypes: ReferenceMap): ReferenceMap => _.pickBy(
    _.mapValues(annoRefTypes, (anno, annoName) => (
      filterFunc(id.createNestedID('annotation').createNestedID(annoName)) ? anno : undefined
    )),
    isDefined,
  )

  if (!filterFunc(id)) {
    return undefined
  }
  if (isObjectType(value)) {
    const filteredFields = Object.values(value.fields)
      .map(field => filterByID(field.elemID, field, filterFunc))
    return new ObjectType({
      elemID: value.elemID,
      annotations: filterAnnotations(value.annotations),
      annotationRefsOrTypes: filterAnnotationType(value.annotationRefTypes),
      fields: _.keyBy(filteredFields.filter(isDefined), field => field.name),
      path: value.path,
      isSettings: value.isSettings,
    }) as Value as T
  }
  if (isPrimitiveType(value)) {
    return new PrimitiveType({
      elemID: value.elemID,
      annotations: filterAnnotations(value.annotations),
      annotationRefsOrTypes: filterAnnotationType(value.annotationRefTypes),
      primitive: value.primitive,
      path: value.path,
    }) as Value as T
  }
  if (isField(value)) {
    return new Field(
      value.parent,
      value.name,
      value.refType,
      filterByID(value.elemID, value.annotations, filterFunc)
    ) as Value as T
  }
  if (isInstanceElement(value)) {
    return new InstanceElement(
      value.elemID.name,
      value.refType,
      filterByID(value.elemID, value.value, filterFunc),
      value.path,
      filterInstanceAnnotations(value.annotations)
    ) as Value as T
  }

  if (_.isPlainObject(value)) {
    const filteredObj = _.pickBy(
      _.mapValues(
        value,
        (val: Value, key: string) => filterByID(id.createNestedID(key), val, filterFunc)
      ),
      isDefined,
    )
    return _.isEmpty(filteredObj) ? undefined : filteredObj as Value as T
  }
  if (_.isArray(value)) {
    const filteredArray = value
      .map((item, i) => filterByID(id.createNestedID(i.toString()), item, filterFunc))
      .filter(isDefined)
    return _.isEmpty(filteredArray) ? undefined : filteredArray as Value as T
  }

  return value
}

// This method iterate on types and corresponding values and run innerChange
// on every "node".
// This method DOESN'T SUPPORT list of lists!
export const applyRecursive = (type: ObjectType | MapType, value: Values,
  innerChange: (field: Field, value: Value) => Value, elementsSource?: ElementsSource): void => {
  if (!value) return

  const objType = toObjectType(type, value)

  Object.keys(objType.fields).forEach(key => {
    if (value[key] === undefined) return
    value[key] = innerChange(objType.fields[key], value[key])
    const fieldType = objType.fields[key].getType(elementsSource)
    if (!isContainerType(fieldType) && !isObjectType(fieldType)) return
    const actualFieldType = isContainerType(fieldType)
      ? fieldType.getInnerType(elementsSource)
      : fieldType
    if (isObjectType(actualFieldType)) {
      if (_.isArray(value[key])) {
        value[key].forEach((val: Values) =>
          applyRecursive(actualFieldType, val, innerChange, elementsSource))
      } else {
        applyRecursive(actualFieldType, value[key], innerChange, elementsSource)
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

const createDefaultValuesFromType = (
  type: TypeElement,
  elementsSrouce?: ElementsSource,
): Values => {
  const createDefaultValuesFromObjectType = (object: ObjectType): Values =>
    _(object.fields).mapValues((field, _name) => {
      if (field.annotations[CORE_ANNOTATIONS.DEFAULT] !== undefined) {
        return field.annotations[CORE_ANNOTATIONS.DEFAULT]
      }
      if (field.getType(elementsSrouce).annotations[CORE_ANNOTATIONS.DEFAULT] !== undefined
        && !isContainerType(field.getType(elementsSrouce))) {
        return createDefaultValuesFromType(field.getType(elementsSrouce))
      }
      return undefined
    }).pickBy(v => v !== undefined).value()

  return (type.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined && isObjectType(type)
    ? createDefaultValuesFromObjectType(type)
    : type.annotations[CORE_ANNOTATIONS.DEFAULT])
}

export const applyInstancesDefaults = (
  instances: InstanceElement[],
  elementsSrouce?: ElementsSource,
): void => {
  // TODO: This implementation is not ideal perfmance wise
  // Grouping by type before using the elementsSource to get the actual type will be an improvement
  instances
    .forEach(inst => {
      const defaultValues = createDefaultValuesFromType(inst.getType(elementsSrouce))
      inst.value = _.merge({}, defaultValues, inst.value)
    })
}

export const createDefaultInstanceFromType = (name: string, objectType: ObjectType):
  InstanceElement => {
  const instance = new InstanceElement(name, objectType)
  instance.value = createDefaultValuesFromType(objectType)
  return instance
}

export const safeJsonStringify = (value: Value): string => safeStringify(value)

export const getAllReferencedIds = (
  element: Element,
  onlyAnnotations = false,
  elementsSource?: ElementsSource,
): Set<string> => {
  const allReferencedIds = new Set<string>()
  const transformFunc: TransformFunc = ({ value }) => {
    if (isReferenceExpression(value)) {
      allReferencedIds.add(value.elemID.getFullName())
    }
    return value
  }

  const transform = onlyAnnotations ? transformElementAnnotations : transformElement
  transform({ element, transformFunc, strict: false, elementsSource })

  return allReferencedIds
}

export const getParents = (element: Element): Array<Value> => (
  collections.array.makeArray(element.annotations[INSTANCE_ANNOTATIONS.PARENT])
)
