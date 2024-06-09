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
import {
  Field,
  Element,
  isInstanceElement,
  Value,
  Values,
  ReferenceExpression,
  InstanceElement,
  ElemID,
  cloneDeepWithoutRefs,
  isElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  buildElementsSourceFromElements,
  GetLookupNameFunc,
  GetLookupNameFuncArgs,
  TransformFunc,
  transformValues,
  safeJsonStringify,
  resolvePath,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues, collections, multiIndex } from '@salto-io/lowerdash'
import {
  ReferenceSerializationStrategy,
  ExtendedReferenceTargetDefinition,
  ReferenceResolverFinder,
  FieldReferenceResolver,
  generateReferenceResolverFinder,
  FieldReferenceDefinition,
  CreateMissingRefFunc,
  GetReferenceIdFunc,
  ReferenceSerializationStrategyLookup,
  ReferenceSourceTransformation,
  ReferenceIndexField,
} from './reference_mapping'
import { ContextFunc } from './context'
import { checkMissingRef } from './missing_references'

const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues

const doNothing: ContextFunc = async () => undefined

const emptyContextStrategyLookup: Record<string, ContextFunc> = {}

const isRelativeSerializer = <CustomIndexField extends string>(
  serializer: ReferenceSerializationStrategy<CustomIndexField>,
): serializer is ReferenceSerializationStrategy<CustomIndexField> & { getReferenceId: GetReferenceIdFunc } =>
  'getReferenceId' in serializer

export const replaceReferenceValues = async <TContext extends string, CustomIndexField extends string>({
  instance,
  resolverFinder,
  elemIDLookupMaps,
  fieldsWithResolvedReferences,
  elementSource,
  contextStrategyLookup = emptyContextStrategyLookup,
}: {
  instance: InstanceElement
  resolverFinder: ReferenceResolverFinder<TContext, CustomIndexField>
  elemIDLookupMaps: Record<string, multiIndex.Index<[string, string], ElemID>>
  fieldsWithResolvedReferences: Set<string>
  elementSource: ReadOnlyElementsSource
  contextStrategyLookup?: Record<TContext, ContextFunc>
}): Promise<Values> => {
  const getRefElem = async ({
    val,
    valTransformation,
    target,
    field,
    path,
    lookupIndexName,
    createMissingReference,
  }: {
    val: string | number
    valTransformation: ReferenceSourceTransformation
    field: Field
    path?: ElemID
    target: ExtendedReferenceTargetDefinition<TContext>
    lookupIndexName?: string
    createMissingReference?: CreateMissingRefFunc
  }): Promise<Element | undefined> => {
    const defaultIndex = Object.values(elemIDLookupMaps).length === 1 ? Object.values(elemIDLookupMaps)[0] : undefined
    const findElem = async (value: string, targetType?: string): Promise<Element | undefined> => {
      const lookup = lookupIndexName !== undefined ? elemIDLookupMaps[lookupIndexName] : defaultIndex

      if (targetType === undefined || lookup === undefined) {
        return undefined
      }

      const elemID = lookup.get(targetType, value)
      if (elemID === undefined) {
        return undefined
      }

      return elementSource.get(elemID)
    }

    const isValidContextFunc = (funcName?: string): boolean =>
      funcName === undefined || Object.keys(contextStrategyLookup).includes(funcName)
    if (!isValidContextFunc(target.parentContext) || !isValidContextFunc(target.typeContext)) {
      return undefined
    }
    const parentContextFunc =
      target.parentContext !== undefined ? contextStrategyLookup[target.parentContext] : doNothing
    const elemParent = target.parent ?? (await parentContextFunc({ instance, elementSource, field, fieldPath: path }))

    const typeContextFunc = target.typeContext !== undefined ? contextStrategyLookup[target.typeContext] : doNothing
    const elemType =
      target.type ??
      (await typeContextFunc({
        instance,
        elementSource,
        field,
        fieldPath: path,
      }))
    return (
      (await findElem(target.lookup(valTransformation.transform(val), elemParent), elemType)) ??
      createMissingReference?.({
        value: val.toString(),
        typeName: elemType,
        adapter: field.elemID.adapter,
      })
    )
  }

  const replacePrimitive = async (val: string | number, field: Field, path?: ElemID): Promise<Value> => {
    const toValidatedReference = async (
      serializer: ReferenceSerializationStrategy<CustomIndexField>,
      sourceTransformation: ReferenceSourceTransformation,
      elem: Element | undefined,
    ): Promise<ReferenceExpression | undefined> => {
      const getReferenceExpression = async (element: Element): Promise<ReferenceExpression | undefined> => {
        if (element.annotations === undefined) {
          // Should never happen, but we saw it happen once, so adding a log
          log.warn(
            'getReferenceExpression got element with no annotations. val=%s, field=%s, path=%s, elem=%s',
            val,
            field?.elemID?.getFullName(),
            path?.getFullName(),
            safeJsonStringify(cloneDeepWithoutRefs(element)),
          )
        }

        const referenceId = isRelativeSerializer(serializer)
          ? serializer.getReferenceId(element.elemID)
          : element.elemID

        if (checkMissingRef(element)) {
          return new ReferenceExpression(referenceId)
        }

        const serializedRefExpression = !isRelativeSerializer(serializer)
          ? await serializer.serialize({
              ref: new ReferenceExpression(element.elemID, elem),
              field,
              element: instance,
              path,
            })
          : resolvePath(element, referenceId)
        // this validation is necessary to create a reference from '$Label.check' and not 'check'
        if (!sourceTransformation.validate(val, serializedRefExpression)) {
          log.warn(
            `Invalid reference ${val} => [${serializedRefExpression} (element '${element.elemID.getFullName()}')]`,
          )
          return undefined
        }

        return new ReferenceExpression(
          referenceId,
          elem !== undefined && !referenceId.isEqual(elem.elemID) ? resolvePath(elem, referenceId) : elem,
        )
      }
      if (elem === undefined) {
        return undefined
      }
      const refExpr = await getReferenceExpression(elem)
      if (refExpr !== undefined) {
        fieldsWithResolvedReferences.add(field.elemID.getFullName())
      }
      return refExpr
    }

    const reference = await awu(await resolverFinder(field, instance))
      .filter(refResolver => refResolver.target !== undefined)
      .map(async refResolver =>
        toValidatedReference(
          refResolver.serializationStrategy,
          refResolver.sourceTransformation,
          await getRefElem({
            val,
            valTransformation: refResolver.sourceTransformation,
            field,
            path,
            target: refResolver.target as ExtendedReferenceTargetDefinition<TContext>,
            lookupIndexName: refResolver.serializationStrategy.lookupIndexName,
            createMissingReference: refResolver.missingRefStrategy?.create,
          }),
        ),
      )
      .filter(isDefined)
      .peek()

    return reference ?? val
  }

  const transformPrimitive: TransformFunc = async ({ value, field, path }) =>
    field !== undefined && (_.isString(value) || _.isNumber(value)) ? replacePrimitive(value, field, path) : value

  return (
    (await transformValues({
      values: instance.value,
      type: await instance.getType(),
      transformFunc: transformPrimitive,
      strict: false,
      pathID: instance.elemID,
      allowEmpty: true,
    })) ?? instance.value
  )
}

/**
 * Convert field values into references, based on predefined rules.
 *
 */
export const addReferences = async <
  ContextStrategy extends string,
  CustomSerializationStrategy extends string,
  CustomIndexField extends string,
  GenericFieldReferenceDefinition extends FieldReferenceDefinition<ContextStrategy, CustomSerializationStrategy>,
>({
  elements,
  contextElements = elements,
  defs,
  fieldsToGroupBy = ['id', 'name'],
  contextStrategyLookup,
  fieldReferenceResolverCreator,
}: {
  elements: Element[]
  contextElements?: Element[]
  defs: GenericFieldReferenceDefinition[]
  fieldsToGroupBy?: (ReferenceIndexField | CustomIndexField)[]
  contextStrategyLookup?: Record<ContextStrategy, ContextFunc>
  fieldReferenceResolverCreator?: (
    def: GenericFieldReferenceDefinition,
  ) => FieldReferenceResolver<ContextStrategy, CustomSerializationStrategy, CustomIndexField>
}): Promise<void> => {
  const resolverFinder = generateReferenceResolverFinder<
    ContextStrategy,
    CustomSerializationStrategy,
    CustomIndexField,
    GenericFieldReferenceDefinition
  >(defs, fieldReferenceResolverCreator)
  const instances = elements.filter(isInstanceElement)

  const indexer = multiIndex.buildMultiIndex<Element>()
  fieldsToGroupBy.forEach(fieldName =>
    indexer.addIndex({
      name: fieldName,
      filter: e => isInstanceElement(e) && e.value[fieldName] !== undefined,
      key: (inst: InstanceElement) => [inst.refType.elemID.name, inst.value[fieldName]],
      map: inst => inst.elemID,
    }),
  )
  const fieldLookups = fieldsToGroupBy.length === 0 ? {} : await indexer.process(awu(contextElements))

  const fieldsWithResolvedReferences = new Set<string>()
  await awu(instances).forEach(async instance => {
    instance.value = await replaceReferenceValues({
      instance,
      resolverFinder,
      elemIDLookupMaps: fieldLookups,
      fieldsWithResolvedReferences,
      elementSource: buildElementsSourceFromElements(contextElements),
      contextStrategyLookup,
    })
  })
  log.debug('added references in the following fields: %s', [...fieldsWithResolvedReferences])
}

export const generateLookupFunc = <
  TContext extends string,
  CustomSerializationStrategy extends string,
  CustomIndexField extends string,
  GenericFieldReferenceDefinition extends FieldReferenceDefinition<TContext, CustomSerializationStrategy>,
>(
  defs: GenericFieldReferenceDefinition[],
  fieldReferenceResolverCreator?: (
    def: GenericFieldReferenceDefinition,
  ) => FieldReferenceResolver<TContext, CustomSerializationStrategy, CustomIndexField>,
): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder<
    TContext,
    CustomSerializationStrategy,
    CustomIndexField,
    GenericFieldReferenceDefinition
  >(defs, fieldReferenceResolverCreator)

  const determineLookupStrategy = async (
    args: GetLookupNameFuncArgs,
  ): Promise<ReferenceSerializationStrategy<CustomIndexField> | undefined> => {
    if (args.field === undefined) {
      log.debug('could not determine field for path %s', args.path?.getFullName())
      return undefined
    }

    const strategies = (await resolverFinder(args.field, args.element))
      .filter(def => def.target?.type === undefined || args.ref.elemID.typeName === def.target.type)
      .map(def => def.serializationStrategy)

    if (strategies.length === 0) {
      log.debug('could not find matching strategy for field %s', args.field.elemID.getFullName())
      return undefined
    }

    if (strategies.length > 1) {
      log.debug(
        'found %d matching strategies for field %s - using the first one',
        strategies.length,
        args.field.elemID.getFullName(),
      )
    }

    return strategies[0]
  }

  return async ({ ref, path, field, element }) => {
    if (!isElement(ref.value)) {
      return ref.value
    }

    const strategy =
      (await determineLookupStrategy({
        ref,
        path,
        field,
        element,
      })) ?? ReferenceSerializationStrategyLookup.fullValue
    if (!isRelativeSerializer(strategy)) {
      return strategy.serialize({ ref, field, element, path })
    }
    return cloneDeepWithoutRefs(ref.value)
  }
}
