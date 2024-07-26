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
import { Element, InstanceElement, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { parseFormulaIdentifier } from '@salto-io/salesforce-formula-parser'
import { collections } from '@salto-io/lowerdash'
import { buildElementsSourceForFetch, ensureSafeFilterFetch, isInstanceOfTypeSync } from './utils'
import { LocalFilterCreator } from '../filter'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from './formula_utils'

const { groupByAsync } = collections.asynciterable

const referenceFieldsWithFormulaIdentifiers: Record<string, string> = {
  FlowCondition: 'leftValueReference',
  FlowTestCondition: 'leftValueReference',
  FlowTestParameter: 'leftValueReference',
}

const transformFieldsToReferences = async (
  fetchedElements: Element[],
  allElements: ReadOnlyElementsSource,
): Promise<void> => {
  const transformInstanceFieldToReference = async (instance: InstanceElement): Promise<void> => {
    const fieldName = referenceFieldsWithFormulaIdentifiers[instance.elemID.typeName]
    const identifierInfo = parseFormulaIdentifier(instance.value[fieldName], instance.elemID.getFullName())
    const referenceElemIds = await referencesFromIdentifiers(identifierInfo)

    const referencesWithValidity = await groupByAsync(referenceElemIds, refElemId =>
      referenceValidity(refElemId, instance.elemID, allElements),
    )

    logInvalidReferences(instance.elemID, referencesWithValidity.invalid ?? [], instance.value[fieldName], [
      identifierInfo,
    ])

    if (!referencesWithValidity.valid) {
      return
    }

    instance.value[fieldName] = new ReferenceExpression(referencesWithValidity.valid[0])
  }

  const fetchedInstances = fetchedElements.filter(
    isInstanceOfTypeSync(...Object.keys(referenceFieldsWithFormulaIdentifiers)),
  )
  fetchedInstances.forEach(transformInstanceFieldToReference)
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
