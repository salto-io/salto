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
import { Element, Field, ReadOnlyElementsSource, ReferenceExpression, Value } from '@salto-io/adapter-api'
import { parseFormulaIdentifier } from '@salto-io/salesforce-formula-parser'
import { collections } from '@salto-io/lowerdash'
import { TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { apiNameSync, buildElementsSourceForFetch, ensureSafeFilterFetch, isInstanceOfTypeSync } from './utils'
import { LocalFilterCreator } from '../filter'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from './formula_utils'
import { FLEXI_PAGE_TYPE, FLOW_METADATA_TYPE } from '../constants'

const { awu, groupByAsync } = collections.asynciterable

const typesWithFieldsWithFormulaReferences = [FLOW_METADATA_TYPE, FLEXI_PAGE_TYPE]

const referenceFieldsWithFormulaIdentifiers: Record<string, string> = {
  FlowCondition: 'leftValueReference',
  FlowTestCondition: 'leftValueReference',
  FlowTestParameter: 'leftValueReference',
  FlowAssignmentItem: 'assignToReference',
  ComponentInstancePropertyListItem: 'value',
  FieldInstance: 'fieldItem',
}

const referenceExpressionFromFieldValue = async (
  topLevelTypeName: string,
  field: Field,
  value: string,
  allElements: ReadOnlyElementsSource,
): Promise<ReferenceExpression | Value> => {
  const topLevelParentInstanceElemId = field.elemID.createTopLevelParentID().parent
  const identifierInfo = parseFormulaIdentifier(value, topLevelParentInstanceElemId.typeName)
  const referenceElemIds = await referencesFromIdentifiers(identifierInfo)
  const referencesWithValidity = await groupByAsync(referenceElemIds, refElemId =>
    referenceValidity(refElemId, topLevelParentInstanceElemId, allElements),
  )

  logInvalidReferences(topLevelParentInstanceElemId, referencesWithValidity.invalid ?? [], value, [identifierInfo])

  if (referencesWithValidity.valid === undefined) {
    return value
  }

  const referencesToOtherTypes = referencesWithValidity.valid.filter(ref => ref.typeName !== topLevelTypeName)

  return referencesToOtherTypes.length > 0 ? new ReferenceExpression(referencesToOtherTypes[0]) : value
}

const transformFieldsToReferences = async (
  fetchedElements: Element[],
  allElements: ReadOnlyElementsSource,
): Promise<void> => {
  const transformInstanceFieldsToReference =
    (topLevelTypeName: string): TransformFunc =>
    async ({ value, field }) => {
      if (!field) {
        return value
      }
      const typeName = apiNameSync(field.parent) ?? ''
      const expectedFieldName = referenceFieldsWithFormulaIdentifiers[typeName]
      if (field.name !== expectedFieldName) {
        return value
      }
      if ((value as string).startsWith('Global.')) {
        const apiName = (value as string).substring(7)
        const globalElements = await awu(await allElements.getAll())
          .filter(e => apiNameSync(e) === apiName)
          .toArray()
        return new ReferenceExpression(globalElements[0].elemID, globalElements[0])
      }
      return referenceExpressionFromFieldValue(topLevelTypeName, field, value, allElements)
    }

  const fetchedInstances = fetchedElements.filter(isInstanceOfTypeSync(...typesWithFieldsWithFormulaReferences))
  await awu(fetchedInstances).forEach(async instance => {
    instance.value =
      (await transformValues({
        values: instance.value,
        type: instance.getTypeSync(),
        transformFunc: transformInstanceFieldsToReference(apiNameSync(instance.getTypeSync()) ?? ''),
      })) ?? {}
  })
}

const FILTER_NAME = 'formulaRefFields'
/**
 * Extract references from fields containing formulas
 * These fields are strings but their contents reference other elements using the formula notation
 */
const filter: LocalFilterCreator = ({ config }) => ({
  name: FILTER_NAME,
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error while parsing formulas',
    config,
    filterName: FILTER_NAME,
    fetchFilterFunc: async fetchedElements => {
      const allElements = buildElementsSourceForFetch(fetchedElements, config)
      await transformFieldsToReferences(fetchedElements, allElements)
    },
  }),
})

export default filter
