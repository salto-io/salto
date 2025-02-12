/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { Element, Field, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies, inspectValue } from '@salto-io/adapter-utils'
import {
  parseFormulaIdentifier,
  extractFormulaIdentifiers,
  FormulaIdentifierInfo,
} from '@salto-io/salesforce-formula-parser'
import { FilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { FORMULA } from '../constants'
import { buildElementsSourceForFetch, ensureSafeFilterFetch, extractFlatCustomObjectFields } from './utils'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from './formula_utils'

const log = logger(module)
const { awu } = collections.asynciterable

const addDependenciesAnnotation = (field: Field, potentialReferenceTargets: Map<string, Element>): void => {
  const formula = field.annotations[FORMULA]
  if (!_.isString(formula)) {
    log.error(`The value of the formula field ${field.elemID.getFullName()} is not a string: ${inspectValue(formula)}`)
    return
  }

  log.debug(`Extracting formula refs from ${field.elemID.getFullName()}: ${formula}`)

  let identifiersInfo: FormulaIdentifierInfo[] = []
  let identifiersCount: number = 0
  try {
    const formulaInfo = extractFormulaIdentifiers(formula).map(identifier =>
      parseFormulaIdentifier(identifier, field.parent.elemID.typeName),
    )
    identifiersInfo = formulaInfo.flat()
    identifiersCount = formulaInfo.length
  } catch (e) {
    log.trace(`Failed to extract references from formula ${formula}: ${e}`)
    return
  }

  // We check the # of refs before we filter bad refs out because otherwise the # of refs will be affected by the
  // filtering.
  const references = referencesFromIdentifiers(identifiersInfo)

  if (references.length < identifiersCount) {
    log.warn(`Some formula identifiers were not converted to references.
      Field: ${field.elemID.getFullName()}
      Formula: ${formula}
      Identifiers: ${inspectValue(identifiersInfo.map(info => info.instance))}
      References: ${inspectValue(references.map(ref => ref.getFullName()))}`)
  }

  const referencesWithValidity = _.groupBy(references, refElemId =>
    referenceValidity(refElemId, field.parent.elemID, potentialReferenceTargets),
  )

  logInvalidReferences(field.elemID, referencesWithValidity.invalid ?? [], formula, identifiersInfo)

  const depsAsRefExpr = (referencesWithValidity.valid ?? []).map(elemId => ({
    reference: new ReferenceExpression(elemId),
  }))

  extendGeneratedDependencies(field, depsAsRefExpr)
}

/**
 * Extract references from formulas
 * Formulas appear in the field definitions of types and may refer to fields in their parent type or in another type.
 * This filter parses formulas, identifies such references and adds them to the _generated_references annotation of the
 * formula field.
 * Note: Currently (pending a fix to SALTO-3176) we only look at formula fields in custom objects.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'customObjectFormulaDependencies',
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error while parsing formulas',
    config,
    fetchFilterFunc: async fetchedElements => {
      const fetchedObjectTypes = fetchedElements.filter(isObjectType)
      const fetchedFormulaFields = fetchedObjectTypes
        .flatMap(extractFlatCustomObjectFields) // Get the types + their fields
        .filter(isFormulaField)
      const allElements = await buildElementsSourceForFetch(fetchedElements, config).getAll()
      const elemIdToElement = await awu(allElements)
        .map(e => [e.elemID.getFullName(), e] as [string, Element])
        .toArray()
      const potentialReferenceTargets = new Map<string, Element>(elemIdToElement)
      fetchedFormulaFields.forEach(field => addDependenciesAnnotation(field, potentialReferenceTargets))
    },
  }),
})

export default filter
