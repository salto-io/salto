/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, ElemID, Field, InstanceElement, ReferenceInfo, Value } from '@salto-io/adapter-api'
import { TransformFuncSync, transformValuesSync } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { parseFormulaIdentifier } from '@salto-io/salesforce-formula-parser'
import { WeakReferencesHandler } from '../types'
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from '../filters/formula_utils'

const { isDefined } = values
const log = logger(module)

const typesWithFieldsWithFormulaReferences = ['Flow']

const referenceFieldsWithFormulaIdentifiers: Record<string, string> = {
  FlowCondition: 'leftValueReference',
  FlowTestCondition: 'leftValueReference',
  FlowTestParameter: 'leftValueReference',
  FlowAssignmentItem: 'assignToReference',
}

const referenceInfoFromFieldValue = (
  instance: InstanceElement,
  path: ElemID,
  field: Field,
  value: Value,
  potentialReferenceTargets: Map<string, Element>,
): ReferenceInfo | undefined => {
  const topLevelParentInstanceElemId = field.elemID.createTopLevelParentID().parent
  const identifierInfo = parseFormulaIdentifier(value, topLevelParentInstanceElemId.typeName)
  const referenceElemIds = referencesFromIdentifiers(identifierInfo)
  const referencesWithValidity = _.groupBy(referenceElemIds, refElemId =>
    referenceValidity(refElemId, topLevelParentInstanceElemId, potentialReferenceTargets),
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
  const potentialReferenceTargets = new Map<string, Element>(elements.map(e => [e.elemID.getFullName(), e]))
  const references: (ReferenceInfo | undefined)[] = []
  const transformInstanceFieldsToReference =
    (instance: InstanceElement): TransformFuncSync =>
    ({ value, field, path }) => {
      if (!field || !path) {
        return value
      }
      const typeName = apiNameSync(field.parent) ?? ''
      const expectedFieldName = referenceFieldsWithFormulaIdentifiers[typeName]
      if (field.name !== expectedFieldName) {
        return value
      }
      try {
        references.push(referenceInfoFromFieldValue(instance, path, field, value, potentialReferenceTargets))
      } catch (e) {
        log.warn('Error when extracting references from `%s`: %s', value, e)
      }
      return value
    }

  const fetchedInstances = elements.filter(isInstanceOfTypeSync(...typesWithFieldsWithFormulaReferences))
  fetchedInstances.forEach(instance => {
    instance.value =
      transformValuesSync({
        values: instance.value,
        type: instance.getTypeSync(),
        pathID: instance.elemID,
        transformFunc: transformInstanceFieldsToReference(instance),
      }) ?? {}
  })

  return references.filter(isDefined)
}

export const formulaRefsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
