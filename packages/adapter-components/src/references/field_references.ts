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
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values as lowerDashValues, collections, multiIndex } from '@salto-io/lowerdash'
import {
  ReferenceSerializationStrategy, ExtendedReferenceTargetDefinition, ReferenceResolverFinder,
  generateReferenceResolverFinder, FieldReferenceDefinition,
} from './reference_mapping'
import { ContextFunc, contextStrategyDefaultLookup } from './context'

const { awu } = collections.asynciterable

const log = logger(module)
const { isDefined } = lowerDashValues

export const replaceReferenceValues = async <
  T extends string
>(
  instance: InstanceElement,
  resolverFinder: ReferenceResolverFinder<T>,
  elemLookupMaps: multiIndex.Index<[string, string], Element>[],
  fieldsWithResolvedReferences: Set<string>,
  elemByElemID: multiIndex.Index<[string], Element>,
  contextStrategyLookup: Record<T, ContextFunc> = contextStrategyDefaultLookup,
): Promise<Values> => {
  const getRefElem = async (
    val: string | number, target: ExtendedReferenceTargetDefinition<T>, field: Field, path?: ElemID
  ): Promise<Element | undefined> => {
    const findElem = (value: string, targetType?: string): Element | undefined => (
      targetType !== undefined
        // TODO make the field we're using to look up more explicit
        ? elemLookupMaps.map(lookup => lookup.get(targetType, value)).find(isDefined)
        : undefined
    )

    const parentContextFunc = contextStrategyLookup[target.parentContext ?? 'none' as T]
    const typeContextFunc = contextStrategyLookup[target.typeContext ?? 'none' as T]
    if (parentContextFunc === undefined || typeContextFunc === undefined) {
      return undefined
    }
    const elemParent = target.parent ?? await parentContextFunc(
      { instance, elemByElemID, field, fieldPath: path }
    )
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
      const res = (await serializer.serialize({
        ref: new ReferenceExpression(elem.elemID, elem),
        field,
      }) === val) ? new ReferenceExpression(elem.elemID, elem) : undefined
      if (res !== undefined) {
        fieldsWithResolvedReferences.add(field.elemID.getFullName())
      }
      return res
    }

    const reference = await awu(await resolverFinder(field))
      .filter(refResolver => refResolver.target !== undefined)
      .map(async refResolver => toValidatedReference(
        refResolver.serializationStrategy,
        await getRefElem(
          val,
          refResolver.target as ExtendedReferenceTargetDefinition<T>,
          field,
          path,
        ),
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
  T extends string
>(
  elements: Element[],
  defs: FieldReferenceDefinition<T>[],
  fieldsToGroupBy: string[] = ['id'],
  contextStrategyLookup?: Record<T, ContextFunc>,
): Promise<void> => {
  const resolverFinder = generateReferenceResolverFinder<T>(defs)
  const instances = elements.filter(isInstanceElement)

  const indexer = multiIndex.buildMultiIndex<Element>().addIndex({
    name: 'elemByElemID',
    key: elem => [elem.elemID.getFullName()],
  })

  fieldsToGroupBy.forEach(fieldName => indexer.addIndex({
    name: `${fieldName}Lookup`,
    filter: e => isInstanceElement(e) && e.value[fieldName] !== undefined,
    key: (inst: InstanceElement) => [inst.refType.elemID.name, inst.value[fieldName]],
  }))
  const { elemByElemID, ...fieldLookups } = await indexer.process(awu(elements))

  const fieldsWithResolvedReferences = new Set<string>()
  await awu(instances).forEach(async instance => {
    instance.value = await replaceReferenceValues(
      instance,
      resolverFinder,
      Object.values(fieldLookups),
      fieldsWithResolvedReferences,
      elemByElemID,
      contextStrategyLookup,
    )
  })
  log.debug('added references in the following fields: %s', [...fieldsWithResolvedReferences])
}
