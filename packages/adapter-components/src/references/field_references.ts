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
import { Field, Element, isInstanceElement, Value, Values, ReferenceExpression, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { GetLookupNameFunc, GetLookupNameFuncArgs, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues, collections, multiIndex } from '@salto-io/lowerdash'
import {
  ReferenceSerializationStrategy, ExtendedReferenceTargetDefinition, ReferenceResolverFinder,
  FieldReferenceResolver, generateReferenceResolverFinder, FieldReferenceDefinition,
} from './reference_mapping'
import { ContextFunc } from './context'

const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues

const doNothing: ContextFunc = async () => undefined

const emptyContextStrategyLookup: Record<string, ContextFunc> = {}

type ValueIsEqualFunc = (lhs?: string | number, rhs?: string | number) => boolean
const defaultIsEqualFunc: ValueIsEqualFunc = (lhs, rhs) => lhs === rhs

export const replaceReferenceValues = async <
  T extends string
>({
  instance,
  resolverFinder,
  elemLookupMaps,
  fieldsWithResolvedReferences,
  elemByElemID,
  contextStrategyLookup = emptyContextStrategyLookup,
  isEqualValue = defaultIsEqualFunc,
}: {
  instance: InstanceElement
  resolverFinder: ReferenceResolverFinder<T>
  elemLookupMaps: Record<string, multiIndex.Index<[string, string], Element>>
  fieldsWithResolvedReferences: Set<string>
  elemByElemID: multiIndex.Index<[string], Element>
  contextStrategyLookup?: Record<T, ContextFunc>
  isEqualValue?: ValueIsEqualFunc
}): Promise<Values> => {
  const getRefElem = async ({ val, target, field, path, lookupIndexName }: {
    val: string | number
    field: Field
    path?: ElemID
    target: ExtendedReferenceTargetDefinition<T>
    lookupIndexName?: string
  }): Promise<Element | undefined> => {
    const defaultIndex = Object.values(elemLookupMaps).length === 1
      ? Object.values(elemLookupMaps)[0]
      : undefined
    const findElem = (
      value: string | number,
      targetType?: string,
    ): Element | undefined => {
      const lookup = lookupIndexName !== undefined ? elemLookupMaps[lookupIndexName] : defaultIndex
      return (
        targetType !== undefined && lookup !== undefined
          ? lookup.get(targetType, _.toString(value))
          : undefined
      )
    }

    const isValidContextFunc = (funcName?: string): boolean => (
      funcName === undefined || Object.keys(contextStrategyLookup).includes(funcName)
    )
    if (
      (!isValidContextFunc(target.parentContext))
      || (!isValidContextFunc(target.typeContext))
    ) {
      return undefined
    }
    const parentContextFunc = target.parentContext !== undefined
      ? contextStrategyLookup[target.parentContext]
      : doNothing
    const elemParent = target.parent ?? await parentContextFunc(
      { instance, elemByElemID, field, fieldPath: path }
    )

    const typeContextFunc = target.typeContext !== undefined
      ? contextStrategyLookup[target.typeContext]
      : doNothing
    const elemType = target.type ?? await typeContextFunc({
      instance, elemByElemID, field, fieldPath: path,
    })

    return findElem(
      target.lookup(val, elemParent),
      elemType,
    )
  }

  const replacePrimitive = async (
    val: string | number, field: Field, path?: ElemID,
  ): Promise<Value> => {
    const toValidatedReference = async (
      serializer: ReferenceSerializationStrategy,
      elem: Element | undefined,
    ): Promise<ReferenceExpression | undefined> => {
      if (elem === undefined) {
        return undefined
      }
      const res = (
        isEqualValue(
          await serializer.serialize({ ref: new ReferenceExpression(elem.elemID, elem), field }),
          val,
        ) ? new ReferenceExpression(elem.elemID, elem)
          : undefined
      )
      if (res !== undefined) {
        fieldsWithResolvedReferences.add(field.elemID.getFullName())
      }
      return res
    }

    const reference = await awu(await resolverFinder(field))
      .filter(refResolver => refResolver.target !== undefined)
      .map(async refResolver => toValidatedReference(
        refResolver.serializationStrategy,
        await getRefElem({
          val,
          field,
          path,
          target: refResolver.target as ExtendedReferenceTargetDefinition<T>,
          lookupIndexName: refResolver.serializationStrategy.lookupIndexName,
        }),
      ))
      .filter(isDefined)
      .peek()

    return reference ?? val
  }

  const transformPrimitive: TransformFunc = async ({ value, field, path }) => (
    (
      field !== undefined
      && (_.isString(value) || _.isNumber(value))
    )
      ? replacePrimitive(value, field, path)
      : value
  )

  return await transformValues(
    {
      values: instance.value,
      type: await instance.getType(),
      transformFunc: transformPrimitive,
      strict: false,
      pathID: instance.elemID,
    }
  ) ?? instance.value
}

/**
 * Convert field values into references, based on predefined rules.
 *
 */
export const addReferences = async <
  T extends string,
  GenericFieldReferenceDefinition extends FieldReferenceDefinition<T>
>({
  elements,
  defs,
  fieldsToGroupBy = ['id'],
  contextStrategyLookup,
  isEqualValue,
  fieldReferenceResolverCreator,
}: {
  elements: Element[]
  defs: GenericFieldReferenceDefinition[]
  fieldsToGroupBy?: string[]
  contextStrategyLookup?: Record<T, ContextFunc>
  isEqualValue?: ValueIsEqualFunc
  fieldReferenceResolverCreator?:
    (def: GenericFieldReferenceDefinition) => FieldReferenceResolver<T>
}): Promise<void> => {
  const resolverFinder = generateReferenceResolverFinder<T, GenericFieldReferenceDefinition>(
    defs, fieldReferenceResolverCreator
  )
  const instances = elements.filter(isInstanceElement)

  // copied from Salesforce - both should be handled similarly:
  // TODO - when transformValues becomes async the first index can be to elemID and not the whole
  // element and we can use the element source directly instead of creating the second index
  const indexer = multiIndex.buildMultiIndex<Element>().addIndex({
    name: 'elemByElemID',
    key: elem => [elem.elemID.getFullName()],
  })

  fieldsToGroupBy.forEach(fieldName => indexer.addIndex({
    name: fieldName,
    filter: e => isInstanceElement(e) && e.value[fieldName] !== undefined,
    key: (inst: InstanceElement) => [inst.refType.elemID.name, inst.value[fieldName]],
  }))
  const { elemByElemID, ...fieldLookups } = await indexer.process(awu(elements))

  const fieldsWithResolvedReferences = new Set<string>()
  await awu(instances).forEach(async instance => {
    instance.value = await replaceReferenceValues({
      instance,
      resolverFinder,
      elemLookupMaps: fieldLookups as Record<string, multiIndex.Index<[string, string], Element>>,
      fieldsWithResolvedReferences,
      elemByElemID,
      contextStrategyLookup,
      isEqualValue,
    })
  })
  log.debug('added references in the following fields: %s', [...fieldsWithResolvedReferences])
}

export const generateLookupFunc = <
  T extends string,
  GenericFieldReferenceDefinition extends FieldReferenceDefinition<T>
>(defs: GenericFieldReferenceDefinition[]): GetLookupNameFunc => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const determineLookupStrategy = async (args: GetLookupNameFuncArgs):
    Promise<ReferenceSerializationStrategy | undefined> => {
    if (args.field === undefined) {
      log.debug('could not determine field for path %s', args.path?.getFullName())
      return undefined
    }
    const strategies = (await resolverFinder(args.field))
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

  return async ({ ref, path, field }) => {
    const strategy = await determineLookupStrategy({ ref, path, field })
    if (strategy !== undefined) {
      return strategy.serialize({ ref, field })
    }

    if (isInstanceElement(ref.value)) {
      return ref.value.value
    }
    return ref.value
  }
}
