/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, ElemID, Field, InstanceElement, ReferenceInfo, Value } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements, TransformFunc, transformValues } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { parseFormulaIdentifier } from '@salto-io/salesforce-formula-parser'
import { WeakReferencesHandler } from '../types'
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from '../filters/formula_utils'

const { awu, groupByAsync } = collections.asynciterable
const { isDefined } = values

const typesWithFieldsWithFormulaReferences = ['Flow']

const referenceFieldsWithFormulaIdentifiers: Record<string, string> = {
  FlowCondition: 'leftValueReference',
  FlowTestCondition: 'leftValueReference',
  FlowTestParameter: 'leftValueReference',
  FlowAssignmentItem: 'assignToReference',
}

const referenceInfoFromFieldValue = async (
  instance: InstanceElement,
  path: ElemID,
  field: Field,
  value: Value,
  allElements: Element[],
): Promise<ReferenceInfo | undefined> => {
  const elmentsSource = buildElementsSourceFromElements(allElements)
  const topLevelParentInstanceElemId = field.elemID.createTopLevelParentID().parent
  const identifierInfo = parseFormulaIdentifier(value, topLevelParentInstanceElemId.typeName)
  const referenceElemIds = referencesFromIdentifiers(identifierInfo)
  const referencesWithValidity = await groupByAsync(referenceElemIds, refElemId =>
    referenceValidity(refElemId, topLevelParentInstanceElemId, elmentsSource),
  )

  logInvalidReferences(topLevelParentInstanceElemId, referencesWithValidity.invalid ?? [], value, [identifierInfo])

  if (referencesWithValidity.valid === undefined) {
    return undefined
  }

  const referencesToOtherTypes = referencesWithValidity.valid.filter(
    ref => ref.typeName !== apiNameSync(instance.getTypeSync()),
  )

  if (referencesToOtherTypes.length === 0) {
    return undefined
  }
  return {
    source: path,
    target: referencesToOtherTypes[0],
    type: 'weak',
  }
}

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const references: (ReferenceInfo | undefined)[] = []
  const transformInstanceFieldsToReference =
    (instance: InstanceElement): TransformFunc =>
    async ({ value, field, path }) => {
      if (!field || !path) {
        return value
      }
      const typeName = apiNameSync(field.parent) ?? ''
      const expectedFieldName = referenceFieldsWithFormulaIdentifiers[typeName]
      if (field.name !== expectedFieldName) {
        return value
      }
      references.push(await referenceInfoFromFieldValue(instance, path, field, value, elements))
      return value
    }

  const fetchedInstances = elements.filter(isInstanceOfTypeSync(...typesWithFieldsWithFormulaReferences))
  await awu(fetchedInstances).forEach(async instance => {
    instance.value =
      (await transformValues({
        values: instance.value,
        type: instance.getTypeSync(),
        pathID: instance.elemID,
        transformFunc: transformInstanceFieldsToReference(instance),
      })) ?? {}
  })

  return references.filter(isDefined)
}

export const formulaRefsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
