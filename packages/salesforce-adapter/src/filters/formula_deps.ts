/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { Element, Field, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { parseFormulaIdentifier, extractFormulaIdentifiers } from '@salto-io/salesforce-formula-parser'
import { FilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { FORMULA } from '../constants'
import { buildElementsSourceForFetch, ensureSafeFilterFetch, extractFlatCustomObjectFields } from './utils'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from './formula_utils'

const log = logger(module)
const { awu, groupByAsync } = collections.asynciterable

const addDependenciesAnnotation = async (
  field: Field,
  potentialReferenceTargets: Map<string, Element>,
): Promise<void> => {
  const formula = field.annotations[FORMULA]
  if (formula === undefined) {
    log.error(`Field ${field.elemID.getFullName()} is a formula field with no formula?`)
    return
  }

  log.debug(`Extracting formula refs from ${field.elemID.getFullName()}`)

  try {
    const formulaIdentifiers: string[] = log.timeDebug(
      () => extractFormulaIdentifiers(formula),
      `Parse formula '${formula.slice(0, 15)}'`,
    )

    const identifiersInfo = await Promise.all(
      formulaIdentifiers.map(async identifier => parseFormulaIdentifier(identifier, field.parent.elemID.typeName)),
    )

    // We check the # of refs before we filter bad refs out because otherwise the # of refs will be affected by the
    // filtering.
    const references = referencesFromIdentifiers(identifiersInfo.flat())

    if (references.length < identifiersInfo.length) {
      log.warn(`Some formula identifiers were not converted to references.
      Field: ${field.elemID.getFullName()}
      Formula: ${formula}
      Identifiers: ${identifiersInfo
        .flat()
        .map(info => info.instance)
        .join(', ')}
      References: ${references.map(ref => ref.getFullName()).join(', ')}`)
    }

    const referencesWithValidity = await groupByAsync(references, refElemId =>
      referenceValidity(refElemId, field.parent.elemID, potentialReferenceTargets),
    )

    logInvalidReferences(field.elemID, referencesWithValidity.invalid ?? [], formula, identifiersInfo)

    const depsAsRefExpr = (referencesWithValidity.valid ?? []).map(elemId => ({
      reference: new ReferenceExpression(elemId),
    }))

    extendGeneratedDependencies(field, depsAsRefExpr)
  } catch (e) {
    log.warn(`Failed to extract references from formula ${formula}: ${e}`)
  }
}

/**
 * Extract references from formulas
 * Formulas appear in the field definitions of types and may refer to fields in their parent type or in another type.
 * This filter parses formulas, identifies such references and adds them to the _generated_references annotation of the
 * formula field.
 * Note: Currently (pending a fix to SALTO-3176) we only look at formula fields in custom objects.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'formulaDeps',
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error while parsing formulas',
    config,
    fetchFilterFunc: async fetchedElements => {
      const fetchedObjectTypes = fetchedElements.filter(isObjectType)
      const fetchedFormulaFields = await awu(fetchedObjectTypes)
        .flatMap(extractFlatCustomObjectFields) // Get the types + their fields
        .filter(isFormulaField)
        .toArray()
      const allElements = await buildElementsSourceForFetch(fetchedElements, config).getAll()
      const elemIdToElement = await awu(allElements)
        .map(e => [e.elemID.getFullName(), e] as [string, Element])
        .toArray()
      const potentialReferenceTargets = new Map<string, Element>(elemIdToElement)
      await Promise.all(fetchedFormulaFields.map(field => addDependenciesAnnotation(field, potentialReferenceTargets)))
    },
  }),
})

export default filter
