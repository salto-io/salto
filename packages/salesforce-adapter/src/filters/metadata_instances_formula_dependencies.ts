/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  InstanceElement,
  Element,
  isInstanceElement,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies, walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  extractFormulaIdentifiers,
  FormulaIdentifierInfo,
  parseFormulaIdentifier,
} from '@salto-io/salesforce-formula-parser'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from './formula_utils'
import { buildElementsSourceForFetch, ensureSafeFilterFetch } from './utils'

const { awu } = collections.asynciterable
const log = logger(module)

const FORMULA_FIELDS = ['formula', 'errorConditionFormula']

const addDependenciesAnnotation = (
  element: Element,
  formula: string,
  potentialReferenceTargets: Map<string, Element>,
): void => {
  let identifiersInfo: FormulaIdentifierInfo[] = []
  try {
    const formulaInfo = extractFormulaIdentifiers(formula).map(identifier =>
      parseFormulaIdentifier(identifier, element.annotations[CORE_ANNOTATIONS.PARENT][0].elemID.typeName),
    )
    identifiersInfo = formulaInfo.flat()
  } catch (e) {
    log.trace(`Failed to extract references from formula ${formula}: ${e}`)
    return
  }
  const references = referencesFromIdentifiers(identifiersInfo)

  const referencesWithValidity = _.groupBy(references, refElemId =>
    referenceValidity(refElemId, element.annotations[CORE_ANNOTATIONS.PARENT][0].elemID, potentialReferenceTargets),
  )

  logInvalidReferences(element.elemID, referencesWithValidity.invalid ?? [], formula, identifiersInfo)

  const depsAsRefExpr = (referencesWithValidity.valid ?? []).map(elemId => ({
    reference: new ReferenceExpression(elemId),
  }))

  extendGeneratedDependencies(element, depsAsRefExpr)
}

const addFormulaDependenciesFunc = (
  element: InstanceElement,
  potentialReferenceTargets: Map<string, Element>,
): void => {
  const elementsFormulas: string[] = []
  const walkOnFunc: WalkOnFunc = ({ value, path }) => {
    if (FORMULA_FIELDS.includes(path.name)) {
      elementsFormulas.push(value)
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element, func: walkOnFunc })
  elementsFormulas
    .filter(_.isString)
    .forEach(formula => addDependenciesAnnotation(element, formula, potentialReferenceTargets))
}

const filter: FilterCreator = ({ config }) => ({
  name: 'addFormulaDependenciesToMetadataInstances',
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error while parsing formulas for metadata instances',
    config,
    fetchFilterFunc: async fetchedElements => {
      const allElements = await buildElementsSourceForFetch(fetchedElements, config).getAll()
      const elemIdToElement = await awu(allElements)
        .map(e => [e.elemID.getFullName(), e] as [string, Element])
        .toArray()
      const potentialReferenceTargets = new Map<string, Element>(elemIdToElement)
      fetchedElements
        .filter(isInstanceElement)
        .forEach(element => addFormulaDependenciesFunc(element, potentialReferenceTargets))
    },
  }),
})

export default filter
