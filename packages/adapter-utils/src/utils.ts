/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import os from 'os'
import wu from 'wu'
import _ from 'lodash'
import { inspect, InspectOptions } from 'util'
import safeStringify from 'fast-safe-stringify'
import { logger } from '@salto-io/logging'
import { types as lowerDashTypes, collections, values as lowerDashValues, promises } from '@salto-io/lowerdash'
import {
  ObjectType,
  isStaticFile,
  ElemID,
  PrimitiveType,
  Values,
  Value,
  isReferenceExpression,
  Element,
  isInstanceElement,
  InstanceElement,
  isPrimitiveType,
  TypeMap,
  isField,
  ReferenceExpression,
  Field,
  InstanceAnnotationTypes,
  isType,
  isObjectType,
  isAdditionChange,
  CORE_ANNOTATIONS,
  TypeElement,
  Change,
  isRemovalChange,
  isModificationChange,
  isListType,
  ChangeData,
  ListType,
  CoreAnnotationTypes,
  isMapType,
  MapType,
  isContainerType,
  isTypeReference,
  ReadOnlyElementsSource,
  ReferenceMap,
  TypeReference,
  createRefToElmWithValue,
  PlaceholderObjectType,
  UnresolvedReference,
  FieldMap,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { extractAdditionalPropertiesField } from './additional_properties'

const { mapValuesAsync } = promises.object
const { awu, mapAsync, toArrayAsync } = collections.asynciterable
const { isDefined, isPlainObject } = lowerDashValues

const log = logger(module)

export type TransformFuncArgs = {
  value: Value
  path?: ElemID
  field?: Field
}
export type TransformFunc = (args: TransformFuncArgs) => Promise<Value> | Value | undefined

export type TransformFuncSync = (args: TransformFuncArgs) => lowerDashTypes.NonPromise<Value> | undefined

type TransformValuesBaseArgs = {
  values: Value
  type: ObjectType | TypeMap | MapType | ListType
  strict?: boolean
  pathID?: ElemID
  isTopLevel?: boolean
  allowEmptyArrays?: boolean
  allowEmptyObjects?: boolean
}

type TransformValuesSyncArgs = TransformValuesBaseArgs & { transformFunc: TransformFuncSync }
type TransformValuesArgs = TransformValuesBaseArgs & {
  transformFunc: TransformFunc
  elementsSource?: ReadOnlyElementsSource
}

export const applyFunctionToChangeData = async <T extends Change<unknown>>(
  change: T,
  func: (arg: ChangeData<T>) => Promise<ChangeData<T>> | ChangeData<T>,
): Promise<T> => {
  if (isAdditionChange(change)) {
    return { ...change, data: { after: await func(change.data.after) } }
  }
  if (isRemovalChange(change)) {
    return { ...change, data: { before: await func(change.data.before) } }
  }
  if (isModificationChange(change)) {
    return {
      ...change,
      data: {
        before: await func(change.data.before),
        after: await func(change.data.after),
      },
    }
  }
  return change
}

/**
 * Generate synthetic object types for validating / transforming map type values.
 *
 * @param type    The map type for determining the field types
 * @param value   The map instance for determining the field names
 */
export const toObjectType = (type: MapType | ObjectType | ListType, value: Values): ObjectType =>
  isObjectType(type)
    ? type
    : new ObjectType({
        elemID: type.elemID,
        fields: Object.fromEntries(Object.keys(value).map(key => [key, { refType: type.refInnerType }])),
        annotationRefsOrTypes: type.annotationRefTypes,
        annotations: type.annotations,
        path: type.path,
      })

type FieldMapperFunc = (key: string) => Field | undefined

const fieldMapperGenerator = (type: ObjectType | TypeMap | MapType | ListType, value: Values): FieldMapperFunc => {
  if (isObjectType(type) || isMapType(type) || isListType(type)) {
    const objType = toObjectType(type, value)
    return name => objType.fields[name] ?? extractAdditionalPropertiesField(objType, name)
  }
  const objType = new ObjectType({ elemID: new ElemID('') })
  return name =>
    type[name] !== undefined
      ? // we set the annotations as type[name].annotations to support hidden_string
        // (or any other type with hidden_value) in instance annotation types.
        new Field(objType, name, type[name], type[name].annotations)
      : undefined
}

const removeEmptyParts = ({
  value,
  allowEmptyArrays,
  allowEmptyObjects,
}: {
  value: Value
  allowEmptyArrays: boolean
  allowEmptyObjects: boolean
}): Value => {
  if (Array.isArray(value)) {
    const filtered = value.filter(isDefined)
    return filtered.length === 0 && (value.length > 0 || !allowEmptyArrays) ? undefined : filtered
  }
  if (_.isPlainObject(value)) {
    const filtered = _.omitBy(value, _.isUndefined)
    return _.isEmpty(filtered) && (!_.isEmpty(value) || !allowEmptyObjects) ? undefined : filtered
  }
  return value
}

type recurseIntoValueArgs = {
  newVal: Value
  transformFunc: (value: Value, keyPathID?: ElemID, field?: Field) => Value
  strict: boolean
  allowEmptyArrays: boolean
  isAsync: boolean
  keyPathID?: ElemID
  field?: Field
  fieldType?: TypeElement
}

const recurseIntoValue = ({
  newVal,
  transformFunc,
  strict,
  allowEmptyArrays,
  isAsync,
  keyPathID,
  field,
  fieldType,
}: recurseIntoValueArgs): Value => {
  if (newVal === undefined) {
    return undefined
  }

  if (isReferenceExpression(newVal)) {
    return newVal
  }

  type AsyncMapFunc<K> = (t: Value, key: K) => Promise<unknown>
  const listMapFunc = isAsync
    ? (list: Iterable<Value>, mapFunc: AsyncMapFunc<number>) => toArrayAsync(mapAsync(list, mapFunc))
    : _.map
  const objMapFunc = isAsync
    ? (obj: Record<string, Value>, mapFunc: AsyncMapFunc<string>) => mapValuesAsync(obj, mapFunc)
    : _.mapValues

  if (field && isListType(fieldType)) {
    const transformListInnerValue = (item: Value, index?: number): Value =>
      transformFunc(
        item,
        !_.isUndefined(index) ? keyPathID?.createNestedID(String(index)) : keyPathID,
        new Field(field.parent, field.name, fieldType.refInnerType, field.annotations),
      )
    if (!_.isArray(newVal)) {
      if (strict) {
        log.debug(`Array value and isListType mis-match for field - ${field.name}. Got non-array for ListType.`)
      }
      return transformListInnerValue(newVal)
    }
    return listMapFunc(newVal, (item: Value, index: number) => transformListInnerValue(item, index))
  }
  if (_.isArray(newVal)) {
    // Even fields that are not defined as ListType can have array values
    return listMapFunc(newVal, (item: Value, index: number) =>
      transformFunc(item, keyPathID?.createNestedID(String(index)), field),
    )
  }

  if (isObjectType(fieldType) || isMapType(fieldType)) {
    if (!_.isPlainObject(newVal)) {
      if (strict) {
        log.debug(`Value mis-match for field ${field?.name} - value is not an object`)
      }
      // _.isEmpty returns true for primitive values (boolean, number)
      // but we do not want to omit those, we only want to omit empty
      // objects, arrays and strings. we don't need to check for objects here
      // because we cannot get here with an object
      const isEmptyString = _.isString(newVal) && _.isEmpty(newVal)
      if (isEmptyString) {
        log.warn(
          'found empty string in path %s, string will be omitted: %s',
          keyPathID?.getFullName(),
          !allowEmptyArrays,
        )
      }
      const valueIsEmpty = (Array.isArray(newVal) && _.isEmpty(newVal)) || isEmptyString
      return valueIsEmpty && !allowEmptyArrays ? undefined : newVal
    }
    const fieldMapper = fieldMapperGenerator(fieldType, newVal)
    return objMapFunc(newVal, (value: Value, key: string) =>
      transformFunc(value, keyPathID?.createNestedID(key), fieldMapper(key)),
    )
  }
  if (_.isPlainObject(newVal) && !strict) {
    return objMapFunc(newVal, (value: Value, key: string) => transformFunc(value, keyPathID?.createNestedID(key)))
  }
  return newVal
}

export const transformValues = async ({
  values,
  type,
  transformFunc,
  strict = true,
  pathID = undefined,
  elementsSource,
  isTopLevel = true,
  allowEmptyArrays = false,
  allowEmptyObjects = false,
}: TransformValuesArgs): Promise<Values | undefined> => {
  const transformValue = async (value: Value, keyPathID?: ElemID, field?: Field): Promise<Value> => {
    if (field === undefined && strict) {
      return undefined
    }

    if (isReferenceExpression(value)) {
      return transformFunc({ value, path: keyPathID, field })
    }

    const newVal = await transformFunc({ value, path: keyPathID, field })
    const recursed = await recurseIntoValue({
      newVal,
      transformFunc: transformValue,
      strict,
      allowEmptyArrays,
      isAsync: true,
      keyPathID,
      field,
      fieldType: await field?.getType(elementsSource),
    })
    return removeEmptyParts({ value: recursed, allowEmptyArrays, allowEmptyObjects })
  }

  const fieldMapper = fieldMapperGenerator(type, values)

  const newVal = isTopLevel ? await transformFunc({ value: values, path: pathID }) : values
  if (_.isPlainObject(newVal)) {
    const result = _.omitBy(
      await mapValuesAsync(newVal ?? {}, (value, key) =>
        transformValue(value, pathID?.createNestedID(key), fieldMapper(key)),
      ),
      _.isUndefined,
    )
    return _.isEmpty(result) && !allowEmptyObjects ? undefined : result
  }
  if (_.isArray(newVal)) {
    const result = await awu(newVal)
      .map((value, index) => transformValue(value, pathID?.createNestedID(String(index)), fieldMapper(String(index))))
      .filter(value => !_.isUndefined(value))
      .toArray()
    return result.length === 0 && !allowEmptyArrays ? undefined : result
  }
  return newVal
}

export const transformValuesSync = ({
  values,
  type,
  transformFunc,
  strict = true,
  pathID = undefined,
  isTopLevel = true,
  allowEmptyArrays = false,
  allowEmptyObjects = false,
}: TransformValuesSyncArgs): lowerDashTypes.NonPromise<Value> | undefined => {
  const transformValue = (value: Value, keyPathID?: ElemID, field?: Field): lowerDashTypes.NonPromise<Value> => {
    if (field === undefined && strict) {
      return undefined
    }

    if (isReferenceExpression(value)) {
      return transformFunc({ value, path: keyPathID, field })
    }

    const newVal = transformFunc({ value, path: keyPathID, field })
    const recursed = recurseIntoValue({
      newVal,
      transformFunc: transformValue,
      strict,
      allowEmptyArrays,
      isAsync: false,
      keyPathID,
      field,
      fieldType: field?.getTypeSync(),
    })
    return removeEmptyParts({ value: recursed, allowEmptyArrays, allowEmptyObjects })
  }

  const fieldMapper = fieldMapperGenerator(type, values)

  const newVal = isTopLevel ? transformFunc({ value: values, path: pathID }) : values
  if (_.isPlainObject(newVal)) {
    const result = _.omitBy(
      _.mapValues(newVal ?? {}, (value, key) => transformValue(value, pathID?.createNestedID(key), fieldMapper(key))),
      _.isUndefined,
    )
    return _.isEmpty(result) && !allowEmptyObjects ? undefined : result
  }
  if (_.isArray(newVal)) {
    const result = newVal
      .map((value, index) => transformValue(value, pathID?.createNestedID(String(index)), fieldMapper(String(index))))
      .filter(value => !_.isUndefined(value))
    return result.length === 0 && !allowEmptyArrays ? undefined : result
  }
  return newVal
}

export const elementAnnotationTypes = async (
  element: Element,
  elementSource?: ReadOnlyElementsSource,
): Promise<TypeMap> => {
  if (isInstanceElement(element)) {
    return InstanceAnnotationTypes
  }

  let annotationsType: Element
  if (isField(element)) {
    annotationsType = await element.getType(elementSource)
  } else if (isObjectType(element)) {
    annotationsType = (await element.getMetaType(elementSource)) ?? element
  } else {
    annotationsType = element
  }

  return {
    ...InstanceAnnotationTypes,
    ...CoreAnnotationTypes,
    ...(await annotationsType.getAnnotationTypes(elementSource)),
  }
}

export const transformElementAnnotations = async <T extends Element>({
  element,
  transformFunc,
  strict,
  elementsSource,
  allowEmptyArrays,
  allowEmptyObjects,
}: {
  element: T
  transformFunc: TransformFunc
  strict?: boolean
  elementsSource?: ReadOnlyElementsSource
  allowEmptyArrays?: boolean
  allowEmptyObjects?: boolean
}): Promise<Values> =>
  (await transformValues({
    values: element.annotations,
    type: await elementAnnotationTypes(element, elementsSource),
    transformFunc,
    strict,
    pathID: isType(element) ? element.elemID.createNestedID('attr') : element.elemID,
    elementsSource,
    allowEmptyArrays,
    allowEmptyObjects,
    isTopLevel: false,
  })) || {}

export const transformElement = async <T extends Element>({
  element,
  transformFunc,
  strict,
  elementsSource,
  runOnFields,
  allowEmptyArrays,
  allowEmptyObjects,
}: {
  element: T
  transformFunc: TransformFunc
  strict?: boolean
  elementsSource?: ReadOnlyElementsSource
  runOnFields?: boolean
  allowEmptyArrays?: boolean
  allowEmptyObjects?: boolean
}): Promise<T> => {
  let newElement: Element
  const transformedAnnotations = await transformElementAnnotations({
    element,
    transformFunc,
    strict,
    elementsSource,
    allowEmptyArrays,
    allowEmptyObjects,
  })

  if (isInstanceElement(element)) {
    const transformedValues =
      (await transformValues({
        values: element.value,
        type: await element.getType(elementsSource),
        transformFunc,
        strict,
        elementsSource,
        pathID: element.elemID,
        allowEmptyArrays,
        allowEmptyObjects,
      })) || {}

    newElement = new InstanceElement(
      element.elemID.name,
      element.refType,
      transformedValues,
      element.path,
      transformedAnnotations,
    )
    return newElement as T
  }

  if (isObjectType(element)) {
    const clonedFields = _.pickBy(
      await mapValuesAsync(element.fields, async field => {
        const transformedField = runOnFields ? await transformFunc({ value: field, path: field.elemID }) : field
        if (transformedField !== undefined) {
          return transformElement({
            element: transformedField,
            transformFunc,
            strict,
            elementsSource,
            runOnFields,
            allowEmptyArrays,
            allowEmptyObjects,
          })
        }
        return undefined
      }),
      isDefined,
    )

    newElement = new ObjectType({
      elemID: element.elemID,
      fields: clonedFields,
      annotationRefsOrTypes: element.annotationRefTypes,
      annotations: transformedAnnotations,
      path: element.path,
      metaType: element.metaType,
      isSettings: element.isSettings,
    })

    return newElement as T
  }

  if (isField(element)) {
    newElement = new Field(element.parent, element.name, await element.getType(elementsSource), transformedAnnotations)

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
      await transformElement({
        element: await element.getInnerType(elementsSource),
        transformFunc,
        strict,
        elementsSource,
        runOnFields,
        allowEmptyArrays,
        allowEmptyObjects,
      }),
    )
    return newElement as T
  }

  if (isMapType(element)) {
    newElement = new MapType(
      await transformElement({
        element: await element.getInnerType(elementsSource),
        transformFunc,
        strict,
        elementsSource,
        runOnFields,
        allowEmptyArrays,
        allowEmptyObjects,
      }),
    )
    return newElement as T
  }

  if (strict) {
    throw new Error('unsupported subtype thingy')
  }

  return element
}

export type GetLookupNameFuncArgs = {
  ref: ReferenceExpression
  field?: Field
  path?: ElemID
  element: Element
}
export type GetLookupNameFunc = (args: GetLookupNameFuncArgs) => Promise<Value>

export type ResolveValuesFunc = <T extends Element>(
  element: T,
  getLookUpName: GetLookupNameFunc,
  elementsSource?: ReadOnlyElementsSource,
  allowEmpty?: boolean,
) => Promise<T>

export const findElements = (elements: Iterable<Element>, id: ElemID): Iterable<Element> =>
  wu(elements).filter(e => e.elemID.isEqual(id))

export const findElement = (elements: Iterable<Element>, id: ElemID): Element | undefined =>
  wu(elements).find(e => e.elemID.isEqual(id))

export const findObjectType = (elements: Iterable<Element>, id: ElemID): ObjectType | undefined => {
  const objects = wu(elements).filter(isObjectType) as wu.WuIterable<ObjectType>
  return objects.find(e => e.elemID.isEqual(id))
}

export const findInstances = (elements: Iterable<Element>, typeID: ElemID): Iterable<InstanceElement> => {
  const instances = wu(elements).filter(isInstanceElement) as wu.WuIterable<InstanceElement>
  return instances.filter(e => e.refType.elemID.isEqual(typeID))
}

export const getPath = (rootElement: Readonly<Element>, fullElemID: ElemID): string[] | undefined => {
  // If rootElement is an objectType or an instance (i.e., a top level element),
  // we want to compare the top level id of fullElemID.
  // If it is a field we want to compare the base id.
  const { parent, path } = rootElement.elemID.isTopLevel()
    ? fullElemID.createTopLevelParentID()
    : fullElemID.createBaseID()

  if (!parent.isEqual(rootElement.elemID)) return undefined
  if (_.isEmpty(path)) return []
  if (fullElemID.isAttrID()) {
    return ['annotations', ...path]
  }
  if (isInstanceElement(rootElement) && fullElemID.idType === 'instance') {
    return ['value', ...path]
  }

  if (fullElemID.idType === 'field') {
    const fieldAnnotations = isObjectType(rootElement) ? path.slice(1) : path
    const fieldAnnotationsPart = ['annotations', ...fieldAnnotations]
    const objectPart = isObjectType(rootElement) ? ['fields', path[0]] : []

    return _.isEmpty(fieldAnnotations) ? objectPart : [...objectPart, ...fieldAnnotationsPart]
  }

  if (isType(rootElement) && fullElemID.isAnnotationTypeID()) {
    const annoTypeName = path[0]
    const annoTypePath = path.slice(1)
    if (_.isEmpty(annoTypePath)) return ['annotationRefTypes', annoTypeName]
    return undefined
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
  // Handle assignment in objects
  if (value === undefined) {
    _.unset(rootElement, path)
  } else {
    _.set(rootElement, path, value)
  }
}

export const resolvePath = (rootElement: Readonly<Element>, fullElemID: ElemID): Value => {
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
    return _.reduce(
      _.keys(values),
      (acc, k) => {
        acc[flatStr(k)] = flatValues(values[k])
        return acc
      },
      {} as Record<string, Value>,
    )
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
  const flattenField = (field: Field): Field =>
    new Field(field.parent, flatStr(field.name), field.refType, flatValues(field.annotations))

  const flattenObjectType = (obj: ObjectType): ObjectType =>
    new ObjectType({
      elemID: obj.elemID,
      annotationRefsOrTypes: _(obj.annotationRefTypes)
        .mapKeys((_v, k) => flatStr(k))
        .value(),
      annotations: flatValues(obj.annotations),
      fields: _(obj.fields)
        .mapKeys((_v, k) => flatStr(k))
        .mapValues(flattenField)
        .value(),
      metaType: obj.metaType,
      isSettings: obj.isSettings,
      path: obj.path?.map(flatStr),
    })

  const flattenPrimitiveType = (prim: PrimitiveType): PrimitiveType =>
    new PrimitiveType({
      elemID: prim.elemID,
      primitive: prim.primitive,
      annotationRefsOrTypes: _.mapKeys(prim.annotationRefTypes, (_v, k) => flatStr(k)),
      annotations: flatValues(prim.annotations),
      path: prim.path?.map(flatStr),
    })

  const flattenInstance = (inst: InstanceElement): InstanceElement =>
    new InstanceElement(
      flatStr(inst.elemID.name),
      inst.refType,
      flatValues(inst.value),
      inst.path?.map(flatStr),
      flatValues(inst.annotations),
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

export enum FILTER_FUNC_NEXT_STEP {
  EXCLUDE, // Exclude this value from the element
  INCLUDE, // include this value
  RECURSE, // Only partial include, continue with the recursion
}

export const filterByID = async <T extends Element | Values>(
  id: ElemID,
  value: T,
  filterFunc: (id: ElemID) => Promise<FILTER_FUNC_NEXT_STEP>,
): Promise<T | undefined> => {
  const filterAnnotations = async (annotations: Values): Promise<Value> =>
    filterByID(id.createNestedID('attr'), annotations, filterFunc)

  const filterAnnotationType = async (annoRefTypes: ReferenceMap): Promise<ReferenceMap | undefined> =>
    filterByID(id.createNestedID('annotation'), annoRefTypes, filterFunc)

  const filterFields = async (fields: FieldMap): Promise<FieldMap | undefined> =>
    filterByID(id.createNestedID('field'), fields, filterFunc)

  const filterResult = await filterFunc(id)
  if (filterResult === FILTER_FUNC_NEXT_STEP.EXCLUDE) {
    return undefined
  }
  if (filterResult === FILTER_FUNC_NEXT_STEP.INCLUDE) {
    return value
  }
  // Only part of the value should be included, continue with the recursion
  if (isObjectType(value)) {
    return new ObjectType({
      elemID: value.elemID,
      annotations: await filterAnnotations(value.annotations),
      annotationRefsOrTypes: await filterAnnotationType(value.annotationRefTypes),
      fields: await filterFields(value.fields),
      path: value.path,
      metaType: value.metaType,
      isSettings: value.isSettings,
    }) as Value as T
  }
  if (isPrimitiveType(value)) {
    return new PrimitiveType({
      elemID: value.elemID,
      annotations: await filterAnnotations(value.annotations),
      annotationRefsOrTypes: await filterAnnotationType(value.annotationRefTypes),
      primitive: value.primitive,
      path: value.path,
    }) as Value as T
  }
  if (isField(value)) {
    return new Field(
      value.parent,
      value.name,
      value.refType,
      await filterByID(value.elemID, value.annotations, filterFunc),
    ) as Value as T
  }
  if (isInstanceElement(value)) {
    return new InstanceElement(
      value.elemID.name,
      value.refType,
      await filterByID(value.elemID, value.value, filterFunc),
      value.path,
      await filterByID(id, value.annotations, filterFunc),
    ) as Value as T
  }

  if (_.isPlainObject(value)) {
    const filteredObj = _.pickBy(
      await mapValuesAsync(value, async (val: Value, key: string) =>
        filterByID(id.createNestedID(key), val, filterFunc),
      ),
      isDefined,
    )
    return !_.isEmpty(value) && _.isEmpty(filteredObj) ? undefined : (filteredObj as Value as T)
  }
  if (_.isArray(value)) {
    const filteredArray = (
      await Promise.all(value.map(async (item, i) => filterByID(id.createNestedID(i.toString()), item, filterFunc)))
    ).filter(isDefined)
    return !_.isEmpty(value) && _.isEmpty(filteredArray) ? undefined : (filteredArray as Value as T)
  }

  return value
}

// This method iterate on types and corresponding values and run innerChange
// on every "node".
// This method DOESN'T SUPPORT list of lists!
export const applyRecursive = async (
  type: ObjectType | MapType,
  value: Values,
  innerChange: (field: Field, value: Value) => Value | Promise<Value>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  if (!value) return

  const objType = toObjectType(type, value)

  await awu(Object.keys(objType.fields)).forEach(async key => {
    if (value[key] === undefined) return
    value[key] = await innerChange(objType.fields[key], value[key])
    const fieldType = await objType.fields[key].getType(elementsSource)
    if (!isContainerType(fieldType) && !isObjectType(fieldType)) return
    const actualFieldType = isContainerType(fieldType) ? await fieldType.getInnerType(elementsSource) : fieldType
    if (isObjectType(actualFieldType)) {
      if (_.isArray(value[key])) {
        await awu(value[key] as Values[]).forEach((val: Values) =>
          applyRecursive(actualFieldType, val, innerChange, elementsSource),
        )
      } else {
        await applyRecursive(actualFieldType, value[key], innerChange, elementsSource)
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

const createDefaultValuesFromType = async (
  type: TypeElement,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Values> => {
  const createDefaultValuesFromObjectType = async (object: ObjectType): Promise<Values> =>
    _.pickBy(
      await mapValuesAsync(object.fields, async (field, _name) => {
        if (field.annotations[CORE_ANNOTATIONS.DEFAULT] !== undefined) {
          return field.annotations[CORE_ANNOTATIONS.DEFAULT]
        }
        if (
          (await field.getType(elementsSource)).annotations[CORE_ANNOTATIONS.DEFAULT] !== undefined &&
          !isContainerType(field.getType(elementsSource))
        ) {
          return createDefaultValuesFromType(await field.getType(elementsSource))
        }
        return undefined
      }),
      v => v !== undefined,
    )

  return type.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined && isObjectType(type)
    ? createDefaultValuesFromObjectType(type)
    : type.annotations[CORE_ANNOTATIONS.DEFAULT]
}

export const applyInstanceDefaults = async (
  element: Element,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Element> => {
  if (isInstanceElement(element)) {
    const defaultValues = await createDefaultValuesFromType(await element.getType(elementsSource), elementsSource)
    element.value = { ...defaultValues, ...element.value }
  }
  return element
}

export const applyInstancesDefaults = (
  elements: AsyncIterable<Element>,
  elementsSource?: ReadOnlyElementsSource,
): AsyncIterable<Element> => awu(elements).map(async element => applyInstanceDefaults(element, elementsSource))

export const createDefaultInstanceFromType = async (name: string, objectType: ObjectType): Promise<InstanceElement> => {
  const instance = new InstanceElement(name, objectType)
  instance.value = await createDefaultValuesFromType(objectType)
  return instance
}

type Replacer = (key: string, value: Value) => Value

export const elementExpressionStringifyReplacer: Replacer = (_key, value) =>
  isReferenceExpression(value) || isTypeReference(value) || isStaticFile(value) || value instanceof ElemID
    ? inspect(value)
    : value

// WARNING: using safeJsonStringify with a customizer is inefficient and should not be done at a large scale.
// prefer inspect / inspectValue (which allows limiting depth / max array length / max string length)
// where applicable
export const safeJsonStringify = (value: Value, replacer?: Replacer, space?: string | number): string =>
  safeStringify(value, replacer, space)

export const inspectValue = (value: Value, options?: InspectOptions): string =>
  inspect(value, _.defaults({}, options ?? {}, { depth: 4 }))

export const getParents = (instance: Element): Array<Value> =>
  collections.array.makeArray(instance.annotations[CORE_ANNOTATIONS.PARENT])

export const getParent = (instance: Element): InstanceElement => {
  const parents = getParents(instance)
  if (parents.length !== 1) {
    throw new Error(`Expected ${instance.elemID.getFullName()} to have exactly one parent, found ${parents.length}`)
  }

  if (!isInstanceElement(parents[0].value)) {
    throw new Error(`Expected ${instance.elemID.getFullName()} parent to be an instance`)
  }

  return parents[0].value
}

// This method is used to get the parent's elemID when the references are not neccessarily resolved
export const getParentElemID = (instance: Element): ElemID => {
  const parents = getParents(instance)
  if (parents.length !== 1) {
    throw new Error(`Expected ${instance.elemID.getFullName()} to have exactly one parent, found ${parents.length}`)
  }
  const parent = parents[0]
  if (!isReferenceExpression(parent)) {
    throw new Error(`Expected ${instance.elemID.getFullName()} parent to be a reference expression`)
  }
  return parent.elemID
}

export const hasValidParent = (element: Element): boolean => {
  try {
    return getParent(element) !== undefined
  } catch {
    return false
  }
}

// In the current use-cases for resolveTypeShallow it makes sense
// to use the value on the ref over the elementsSource, unlike the
// current Reference.getResolvedValue implementation
// That's why we need this func and do not use getResolvedValue
// If we decide switch the getResolvedValue behavior in the future we should lose this
const getResolvedRef = async <T extends TypeElement>(
  ref: TypeReference<T>,
  elementsSource: ReadOnlyElementsSource,
): Promise<TypeReference<T | PlaceholderObjectType>> => {
  if (ref.type !== undefined) {
    return ref
  }
  const sourceVal = await elementsSource.get(ref.elemID)
  if (sourceVal === undefined) {
    log.warn(
      'ElemID %s does not exist on the refType and elementsSource. Returning PlaceholderObjectType instead.',
      ref.elemID.getFullName(),
    )
    return createRefToElmWithValue(
      new PlaceholderObjectType({
        elemID: ref.elemID,
      }),
    )
  }
  return createRefToElmWithValue(sourceVal)
}

export const resolveTypeShallow = async (element: Element, elementsSource: ReadOnlyElementsSource): Promise<void> => {
  element.annotationRefTypes = await mapValuesAsync(element.annotationRefTypes, async annotationRefType =>
    getResolvedRef(annotationRefType, elementsSource),
  )
  if (isInstanceElement(element) || isField(element)) {
    element.refType = await getResolvedRef(element.refType, elementsSource)
  }
  if (isObjectType(element)) {
    await awu(Object.values(element.fields)).forEach(async field => resolveTypeShallow(field, elementsSource))
    if (element.metaType !== undefined) {
      element.metaType = await getResolvedRef(element.metaType, elementsSource)
    }
  }
}

export const createSchemeGuard =
  <T>(scheme: Joi.AnySchema, errorMessage?: string): ((value: unknown) => value is T) =>
  (value): value is T => {
    const { error } = scheme.validate(value)
    if (error !== undefined) {
      if (errorMessage !== undefined) {
        log.error(`${errorMessage}: ${error.message}, ${inspectValue(value)}`)
      }
      return false
    }
    return true
  }
export const createSchemeGuardForInstance =
  <T extends InstanceElement>(
    scheme: Joi.AnySchema,
    errorMessage?: string,
  ): ((instance: InstanceElement) => instance is T) =>
  (instance): instance is T => {
    const { error } = scheme.validate(instance.value)
    if (error !== undefined) {
      if (errorMessage !== undefined) {
        log.error(
          'Error validating instance %s: %s, %s. Value: %s',
          instance.elemID.getFullName(),
          errorMessage,
          error.message,
          inspectValue(instance.value),
        )
      }
      return false
    }
    return true
  }

export function validatePlainObject(obj: unknown, valueName: string): asserts obj is Values {
  if (!isPlainObject(obj)) {
    const objStr = inspect(obj)
    log.warn('Expected  %s to be a plain object, but got %s', valueName, objStr)
    throw new Error(`Expected ${valueName} to be a plain object, but got ${objStr}`)
  }
}

export function validateArray(obj: unknown, valueName: string): asserts obj is unknown[] {
  if (!Array.isArray(obj)) {
    const objStr = inspect(obj)
    log.warn('Expected %s to be an array, but got %s', valueName, objStr)
    throw new Error(`Expected ${valueName} to be an array, but got ${objStr}`)
  }
}

export const getSubtypes = (types: ObjectType[], validateUniqueness = false): ObjectType[] => {
  const subtypes: Record<string, ObjectType> = {}

  const findSubtypes = (type: ObjectType): void => {
    const additionalPropertiesRefType = type.annotations[CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]?.refType?.value
    const fieldsTypes = Object.values(type.fields).map(field => field.getTypeSync())
    const allSubtypes = isType(additionalPropertiesRefType)
      ? [...fieldsTypes, additionalPropertiesRefType]
      : fieldsTypes
    allSubtypes.forEach(fieldContainerOrType => {
      const fieldType = isContainerType(fieldContainerOrType)
        ? fieldContainerOrType.getInnerTypeSync()
        : fieldContainerOrType

      if (!isObjectType(fieldType) || types.includes(fieldType)) {
        return
      }
      if (fieldType.elemID.getFullName() in subtypes) {
        if (validateUniqueness && !subtypes[fieldType.elemID.getFullName()].isEqual(fieldType)) {
          log.warn(`duplicate ElemIDs of subtypes found. The duplicate is ${fieldType.elemID.getFullName()}`)
        }
        return
      }

      subtypes[fieldType.elemID.getFullName()] = fieldType
      findSubtypes(fieldType)
    })
  }

  types.forEach(findSubtypes)

  return Object.values(subtypes)
}

export const formatConfigSuggestionsReasons = (reasons: string[]): string => {
  if (_.isEmpty(reasons)) {
    return ''
  }

  const formatReason = (reason: string): string => `    * ${reason}`

  return [...reasons.map(formatReason)].join(os.EOL)
}

/* Checks for references expression with undefined value or for unresolved references
 * during fetch and deploy. In fetch this can happen when the reference is set to be missing reference.
 * In deploy this can happen when the reference is assigned as unresolved reference.
 * If the element's source is the elementsSource then this function will return always false.
 */
export const isResolvedReferenceExpression = (value: unknown): value is ReferenceExpression =>
  isReferenceExpression(value) && !(value.value instanceof UnresolvedReference) && value.value !== undefined

export const getParentAsyncWithElementsSource = async (
  instance: Element,
  elementsSource: ReadOnlyElementsSource,
): Promise<InstanceElement> => {
  const parents = getParents(instance)
  if (parents.length !== 1) {
    throw new Error(`Expected ${instance.elemID.getFullName()} to have exactly one parent, found ${parents.length}`)
  }
  const parentReference = parents[0]
  const parent = isResolvedReferenceExpression(parentReference)
    ? parentReference.value
    : await elementsSource.get(parentReference.elemID)
  if (!isInstanceElement(parent)) {
    throw new Error(`Expected ${instance.elemID.getFullName()} parent to be an instance`)
  }
  return parent
}

export const getInstancesFromElementSource = async (
  elementSource: ReadOnlyElementsSource,
  typeNames: string[],
): Promise<InstanceElement[]> =>
  awu(await elementSource.list())
    .filter(id => id.idType === 'instance' && typeNames.includes(id.typeName))
    .map(id => elementSource.get(id))
    .toArray()

export const validateReferenceExpression =
  (fieldName: string): Joi.CustomValidator =>
  (value, helpers) => {
    if (!isReferenceExpression(value)) {
      return helpers.message({ custom: `Expected ${fieldName} to be ReferenceExpression` })
    }
    return true
  }

/**
 * For a list of ElemIDs, returns a list of ElemIDs that are not children of any other ElemID in the list.
 */
export const getIndependentElemIDs = (elemIDs: ElemID[]): ElemID[] => {
  // The sort here is to make sure an elemID of inner path in list items
  // will appear after the elemID of the item itself.
  const sortedIDs = _.sortBy(elemIDs, id => id.getFullNameParts())
  let lastId = sortedIDs[0]
  const fullNamesToReturn = new Set(
    sortedIDs
      .filter(id => {
        const skip = lastId.isParentOf(id)
        if (!skip) {
          lastId = id
        }
        return !skip
      })
      .map(id => id.getFullName()),
  )
  // filter the original list to avoid changing the list order
  return elemIDs.filter(id => fullNamesToReturn.has(id.getFullName()))
}
