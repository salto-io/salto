/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { Element, Field, isObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { parseFormulaIdentifier, extractFormulaIdentifiers } from '@salto-io/salesforce-formula-parser'
import { LocalFilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { FORMULA } from '../constants'
import { buildElementsSourceForFetch, ensureSafeFilterFetch, extractFlatCustomObjectFields } from './utils'
import { logInvalidReferences, referencesFromIdentifiers, referenceValidity } from './formula_utils'

const log = logger(module)
const { awu, groupByAsync } = collections.asynciterable

const addDependenciesAnnotation = async (field: Field, allElements: ReadOnlyElementsSource): Promise<void> => {
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

    const identifiersInfo = await log.timeDebug(
      () =>
        Promise.all(
          formulaIdentifiers.map(async identifier => parseFormulaIdentifier(identifier, field.parent.elemID.typeName)),
        ),
      'Convert formula identifiers to references',
    )

    // We check the # of refs before we filter bad refs out because otherwise the # of refs will be affected by the
    // filtering.
    const references = await referencesFromIdentifiers(identifiersInfo.flat())

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
      referenceValidity(refElemId, field.parent.elemID, allElements),
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

const addDependenciesToFormulaFields = async (
  fetchedElements: Element[],
  allElements: ReadOnlyElementsSource,
): Promise<void> => {
  const fetchedObjectTypes = fetchedElements.filter(isObjectType)
  const fetchedFormulaFields = await awu(fetchedObjectTypes)
    .flatMap(extractFlatCustomObjectFields) // Get the types + their fields
    .filter(isFormulaField)
    .toArray()
  await Promise.all(fetchedFormulaFields.map(field => addDependenciesAnnotation(field, allElements)))
}

const FILTER_NAME = 'formulaDeps'
/**
 * Extract references from formulas
 * Formulas appear in the field definitions of types and may refer to fields in their parent type or in another type.
 * This filter parses formulas, identifies such references and adds them to the _generated_references annotation of the
 * formula field.
 * Note: Currently (pending a fix to SALTO-3176) we only look at formula fields in custom objects.
 */
const filter: LocalFilterCreator = ({ config }) => ({
  name: FILTER_NAME,
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error while parsing formulas',
    config,
    filterName: FILTER_NAME,
    fetchFilterFunc: async fetchedElements => {
      const allElements = buildElementsSourceForFetch(fetchedElements, config)
      await addDependenciesToFormulaFields(fetchedElements, allElements)
    },
  }),
})

export default filter
