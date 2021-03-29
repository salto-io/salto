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
import wu from 'wu'
import _ from 'lodash'
import safeStringify from 'fast-safe-stringify'
import { logger } from '@salto-io/logging'
import { collections, values as lowerDashValues, promises } from '@salto-io/lowerdash'
import {
  ObjectType, isStaticFile, StaticFile, ElemID, PrimitiveType, Values, Value, isReferenceExpression,
  Element, isInstanceElement, InstanceElement, isPrimitiveType, TypeMap, isField, ChangeDataType,
  ReferenceExpression, Field, InstanceAnnotationTypes, isType, isObjectType, isAdditionChange,
  CORE_ANNOTATIONS, TypeElement, Change, isRemovalChange, isModificationChange, isListType,
  ChangeData, ListType, CoreAnnotationTypes, isMapType, MapType, isContainerType,
  ReadOnlyElementsSource, ReferenceMap, BuiltinTypesRefByFullName,
} from '@salto-io/adapter-api'

const { mapValuesAsync } = promises.object
const { awu } = collections.asynciterable
const { isDefined } = lowerDashValues

const log = logger(module)

export const applyFunctionToChangeData = async <T extends Change<unknown>>(
  change: T, func: (arg: ChangeData<T>) => Promise<ChangeData<T>> | ChangeData<T>,
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

export const createRefToElmWithValue = (element: Element): ReferenceExpression => (
  // For BuiltinTypes we use a hardcoded list of refs with values to avoid duplicate instances
  BuiltinTypesRefByFullName[element.elemID.getFullName()]
    ?? new ReferenceExpression(element.elemID, element)
)

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
  return name => (
    type[name] !== undefined
      // we set the annotations as type[name].annotations to support hidden_string
      // (or any other type with hidden_value) in instance annotation types.
      ? new Field(objType, name, type[name], type[name].annotations)
      : undefined
  )
}

export type TransformFuncArgs = {
  value: Value
  path?: ElemID
  field?: Field
}
export type TransformFunc = (args: TransformFuncArgs) => Promise<Value> | Value | undefined

export const transformValues = async (
  {
    values,
    type,
    transformFunc,
    strict = true,
    pathID = undefined,
    elementsSource,
    isTopLevel = true,
    allowEmpty = false,
  }: {
    values: Value
    type: ObjectType | TypeMap | MapType
    transformFunc: TransformFunc
    strict?: boolean
    pathID?: ElemID
    elementsSource?: ReadOnlyElementsSource
    isTopLevel?: boolean
    allowEmpty?: boolean
  }
): Promise<Values | undefined> => {
  const transformValue = async (
    value: Value,
    keyPathID?: ElemID, field?: Field): Promise<Value> => {
    if (field === undefined && strict) {
      return undefined
    }

    if (isReferenceExpression(value)) {
      return transformFunc({ value, path: keyPathID, field })
    }

    const newVal = await transformFunc({ value, path: keyPathID, field })
    if (newVal === undefined) {
      return undefined
    }

    if (isReferenceExpression(newVal)) {
      return newVal
    }

    const fieldType = await field?.getType(elementsSource)

    if (field && isListType(fieldType)) {
      const transformListInnerValue = async (item: Value, index?: number): Promise<Value> =>
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
      const transformed = await awu(newVal)
        .map((v, i) => transformListInnerValue(v, i))
        .filter((val: Value) => !_.isUndefined(val))
        .toArray()
      return transformed.length === 0 && (newVal.length > 0 || !allowEmpty)
        ? undefined
        : transformed
    }
    if (_.isArray(newVal)) {
      // Even fields that are not defined as ListType can have array values
      const transformed = await awu(newVal)
        .map((item, index) => transformValue(item, keyPathID?.createNestedID(String(index)), field))
        .filter(val => !_.isUndefined(val))
        .toArray()
      return transformed.length === 0 && (newVal.length > 0 || !allowEmpty)
        ? undefined
        : transformed
    }

    if ((_.isPlainObject(newVal) || !allowEmpty)
      && (isObjectType(fieldType) || isMapType(fieldType))) {
      const transformed = _.omitBy(
        await transformValues({
          values: newVal,
          type: fieldType,
          transformFunc,
          strict,
          pathID: keyPathID,
          elementsSource,
          isTopLevel: false,
          allowEmpty,
        }),
        _.isUndefined
      )
      return _.isEmpty(transformed) && (!_.isEmpty(newVal) || !allowEmpty) ? undefined : transformed
    }
    if (_.isPlainObject(newVal) && !strict) {
      const transformed = _.omitBy(
        await mapValuesAsync(
          newVal ?? {},
          (val, key) => transformValue(val, keyPathID?.createNestedID(key)),
        ),
        _.isUndefined,
      )
      return _.isEmpty(transformed) && (!allowEmpty || !_.isEmpty(newVal)) ? undefined : transformed
    }
    return newVal
  }

  const fieldMapper = fieldMapperGenerator(type, values)

  const newVal = isTopLevel ? await transformFunc({ value: values, path: pathID }) : values
  const result = _.omitBy(
    await mapValuesAsync(
      newVal ?? {},
      (value, key) => transformValue(value, pathID?.createNestedID(key), fieldMapper(key))
    ),
    _.isUndefined
  )
  return _.isEmpty(result) ? undefined : result
}

export const elementAnnotationTypes = async (
  element: Element,
  elementsSource?: ReadOnlyElementsSource
): Promise<TypeMap> => {
  if (isInstanceElement(element)) {
    return InstanceAnnotationTypes
  }

  return {
    ...InstanceAnnotationTypes,
    ...CoreAnnotationTypes,
    ...(isField(element)
      ? await (await element.getType(elementsSource)).getAnnotationTypes(elementsSource)
      : await element.getAnnotationTypes(elementsSource)),
  }
}

export const transformElementAnnotations = async <T extends Element>(
  {
    element,
    transformFunc,
    strict,
    elementsSource,
  }: {
    element: T
    transformFunc: TransformFunc
    strict?: boolean
    elementsSource?: ReadOnlyElementsSource
  }
): Promise<Values> => await transformValues({
  values: element.annotations,
  type: await elementAnnotationTypes(element, elementsSource),
  transformFunc,
  strict,
  pathID: isType(element) ? element.elemID.createNestedID('attr') : element.elemID,
  elementsSource,
  isTopLevel: false,
}) || {}

export const transformElement = async <T extends Element>(
  {
    element,
    transformFunc,
    strict,
    elementsSource,
    runOnFields,
  }: {
    element: T
    transformFunc: TransformFunc
    strict?: boolean
    elementsSource?: ReadOnlyElementsSource
    runOnFields?: boolean
  }
): Promise<T> => {
  let newElement: Element
  const transformedAnnotations = await transformElementAnnotations({
    element,
    transformFunc,
    strict,
    elementsSource,
  })

  if (isInstanceElement(element)) {
    const transformedValues = await transformValues({
      values: element.value,
      type: await element.getType(elementsSource),
      transformFunc,
      strict,
      elementsSource,
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
    const clonedFields = _.pickBy(
      await mapValuesAsync(
        element.fields,
        async field => {
          const transformedField = (runOnFields
            ? await transformFunc({ value: field, path: field.elemID })
            : field)
          if (transformedField !== undefined) {
            return transformElement({
              element: transformedField,
              transformFunc,
              strict,
              elementsSource,
              runOnFields,
            })
          }
          return undefined
        },
      ),
      isDefined,
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
      await element.getType(elementsSource),
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
      await transformElement({
        element: await element.getInnerType(elementsSource),
        transformFunc,
        strict,
        elementsSource,
        runOnFields,
      })
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
      })
    )
    return newElement as T
  }

  if (strict) {
    throw new Error('unsupported subtype yhingy')
  }

  return element
}

export type GetLookupNameFuncArgs = {
  ref: ReferenceExpression
  field?: Field
  path?: ElemID
}
export type GetLookupNameFunc = (args: GetLookupNameFuncArgs) => Promise<Value>

export type ResolveValuesFunc = <T extends Element>(
  element: T,
  getLookUpName: GetLookupNameFunc
) => Promise<T>

export const resolveValues: ResolveValuesFunc = async (element, getLookUpName) => {
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
) => Promise<T>

export const restoreValues: RestoreValuesFunc = async (source, targetElement, getLookUpName) => {
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

  await transformElement({
    element: source,
    transformFunc: createPathMapCallback,
    strict: false,
  })

  const restoreValuesFunc: TransformFunc = async ({ value, field, path }) => {
    if (path === undefined) {
      return value
    }

    const ref = allReferencesPaths.get(path.getFullName())
    if (ref !== undefined
      && _.isEqual(await getLookUpName({ ref, field, path }), value)) {
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

export const restoreChangeElement = async (
  change: Change,
  sourceElements: Record<string, ChangeDataType>,
  getLookUpName: GetLookupNameFunc,
  restoreValuesFunc = restoreValues,
): Promise<Change> => applyFunctionToChangeData(
  change,
  changeData => restoreValuesFunc(
    sourceElements[changeData.elemID.getFullName()], changeData, getLookUpName,
  )
)

export const resolveChangeElement = (
  change: Change,
  getLookUpName: GetLookupNameFunc,
  resolveValuesFunc = resolveValues,
): Promise<Change> => applyFunctionToChangeData(
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
  fullElemID: ElemID,
): string[] | undefined => {
  const { parent, path } = fullElemID.createTopLevelParentID()
  if (!parent.isEqual(rootElement.elemID)) return undefined
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

export const filterByID = async <T extends Element | Values>(
  id: ElemID, value: T,
  filterFunc: (id: ElemID) => Promise<boolean>
): Promise<T | undefined> => {
  const filterInstanceAnnotations = async (annotations: Value): Promise<Value> => (
    filterByID(id, annotations, filterFunc)
  )

  const filterAnnotations = async (annotations: Value): Promise<Value> => (
    filterByID(id.createNestedID('attr'), annotations, filterFunc)
  )

  const filterAnnotationType = async (annoRefTypes: ReferenceMap): Promise<ReferenceMap> =>
    _.pickBy(
      await mapValuesAsync(annoRefTypes, async (anno, annoName) => (
        await filterFunc(id.createNestedID('annotation').createNestedID(annoName)) ? anno : undefined
      )),
      isDefined,
    )

  if (!(await filterFunc(id))) {
    return undefined
  }
  if (isObjectType(value)) {
    const filteredFields = await Promise.all(Object.values(value.fields)
      .map(field => filterByID(field.elemID, field, filterFunc)))
    return new ObjectType({
      elemID: value.elemID,
      annotations: await filterAnnotations(value.annotations),
      annotationRefsOrTypes: await filterAnnotationType(value.annotationRefTypes),
      fields: _.keyBy(filteredFields.filter(isDefined), field => field.name),
      path: value.path,
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
      await filterByID(value.elemID, value.annotations, filterFunc)
    ) as Value as T
  }
  if (isInstanceElement(value)) {
    return new InstanceElement(
      value.elemID.name,
      value.refType,
      await filterByID(value.elemID, value.value, filterFunc),
      value.path,
      await filterInstanceAnnotations(value.annotations)
    ) as Value as T
  }

  if (_.isPlainObject(value)) {
    const filteredObj = _.pickBy(
      await mapValuesAsync(
        value,
        async (val: Value, key: string) => filterByID(id.createNestedID(key), val, filterFunc)
      ),
      isDefined,
    )
    return _.isEmpty(filteredObj) ? undefined : filteredObj as Value as T
  }
  if (_.isArray(value)) {
    const filteredArray = (await Promise.all(value
      .map(async (item, i) => filterByID(id.createNestedID(i.toString()), item, filterFunc))))
      .filter(isDefined)
    return _.isEmpty(filteredArray) ? undefined : filteredArray as Value as T
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
    const actualFieldType = isContainerType(fieldType)
      ? await fieldType.getInnerType(elementsSource)
      : fieldType
    if (isObjectType(actualFieldType)) {
      if (_.isArray(value[key])) {
        await awu(value[key] as Values[]).forEach((val: Values) =>
          applyRecursive(actualFieldType, val, innerChange, elementsSource))
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
  elementsSrouce?: ReadOnlyElementsSource,
): Promise<Values> => {
  const createDefaultValuesFromObjectType = async (object: ObjectType): Promise<Values> =>
    _.pickBy(
      await mapValuesAsync(object.fields, async (field, _name) => {
        if (field.annotations[CORE_ANNOTATIONS.DEFAULT] !== undefined) {
          return field.annotations[CORE_ANNOTATIONS.DEFAULT]
        }
        if ((await field.getType(elementsSrouce))
          .annotations[CORE_ANNOTATIONS.DEFAULT] !== undefined
            && !isContainerType(field.getType(elementsSrouce))) {
          return createDefaultValuesFromType(await field.getType(elementsSrouce))
        }
        return undefined
      }),
      v => v !== undefined
    )


  return (type.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined && isObjectType(type)
    ? createDefaultValuesFromObjectType(type)
    : type.annotations[CORE_ANNOTATIONS.DEFAULT])
}

export const applyInstanceDefaults = async (
  element: Element,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Element> => {
  if (isInstanceElement(element)) {
    const defaultValues = await createDefaultValuesFromType(
      await element.getType(elementsSource),
      elementsSource
    )
    element.value = { ...defaultValues, ...element.value }
  }
  return element
}

export const applyInstancesDefaults = (
  elements: AsyncIterable<Element>,
  elementsSource?: ReadOnlyElementsSource,
): AsyncIterable<Element> => awu(elements)
  .map(async element => applyInstanceDefaults(element, elementsSource))

export const createDefaultInstanceFromType = async (name: string, objectType: ObjectType):
  Promise<InstanceElement> => {
  const instance = new InstanceElement(name, objectType)
  instance.value = await createDefaultValuesFromType(objectType)
  return instance
}

export const safeJsonStringify = (value: Value,
  replacer?: (key: string, value: Value) => Value,
  space?: string | number): string =>
  safeStringify(value, replacer, space)

export const getAllReferencedIds = async (
  element: Element,
  onlyAnnotations = false,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Set<string>> => {
  const allReferencedIds = new Set<string>()
  const transformFunc: TransformFunc = ({ value }) => {
    if (isReferenceExpression(value)) {
      allReferencedIds.add(value.elemID.getFullName())
    }
    return value
  }

  if (onlyAnnotations) {
    await transformElementAnnotations({ element, transformFunc, strict: false, elementsSource })
  } else {
    await transformElement({ element, transformFunc, strict: false, elementsSource })
  }

  return allReferencedIds
}

export const getParents = (instance: Element): Array<Value> => (
  collections.array.makeArray(instance.annotations[CORE_ANNOTATIONS.PARENT])
)

export const extendGeneratedDependencies = (
  elem: Element,
  newDependencies: ReferenceExpression[],
): void => {
  elem.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = _.sortedUniqBy(
    _.sortBy(
      [
        ...collections.array.makeArray(elem.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]),
        ...newDependencies,
      ],
      ref => ref.elemID.getFullName(),
    ),
    ref => ref.elemID.getFullName(),
  )
}
