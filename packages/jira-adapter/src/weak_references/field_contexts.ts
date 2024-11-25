/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  GetCustomReferencesFunc,
  InstanceElement,
  ReadOnlyElementsSource,
  ReferenceExpression,
  ReferenceInfo,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { CONTEXTS, PROJECT_IDS } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'
import { removeMissingContextProjects } from './context_projects'

const { awu } = collections.asynciterable

const getFieldReferences = (instance: InstanceElement): ReferenceInfo[] => {
  const fieldContexts = instance.value[CONTEXTS]
  if (fieldContexts === undefined || !Array.isArray(fieldContexts)) {
    return []
  }

  return fieldContexts
    .map((contextRef, index) =>
      isReferenceExpression(contextRef)
        ? {
            source: instance.elemID.createNestedID(CONTEXTS, index.toString()),
            target: contextRef.elemID,
            type: 'weak' as const,
          }
        : undefined,
    )
    .filter(values.isDefined)
}

/**
 * Marks each context reference in fields as a weak reference
 */
const getFieldsToContextsReferences: GetCustomReferencesFunc = async elements =>
  elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
    .flatMap(instance => getFieldReferences(instance))

const isContextWithValidProjects = async (
  fieldContext: ReferenceExpression,
  elementsSource: ReadOnlyElementsSource,
): Promise<boolean> => {
  if (!(await elementsSource.has(fieldContext.elemID))) {
    return false
  }
  const context = await elementsSource.get(fieldContext.elemID)
  const { fixedElements } = await removeMissingContextProjects()({ elementsSource })([context])
  // if there was no fix (includes also global context) the context will be valid
  return (
    fixedElements.length === 0 ||
    (isInstanceElement(fixedElements[0]) && fixedElements[0].value[PROJECT_IDS].length > 0)
  )
}

/**
 * Remove contexts that are not global and will become global due to missing projects.
 */
const removeContextsWithMissingProjects: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements => {
    const fixedElements = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_TYPE_NAME)
      .map(async instance => {
        const fieldContexts = instance.value[CONTEXTS]
        if (fieldContexts === undefined || !Array.isArray(fieldContexts)) {
          return undefined
        }

        const fixedInstance = instance.clone()
        fixedInstance.value[CONTEXTS] = await awu(fieldContexts)
          .filter(
            async fieldContext =>
              !isReferenceExpression(fieldContext) || isContextWithValidProjects(fieldContext, elementsSource),
          )
          .toArray()

        if (fixedInstance.value[CONTEXTS].length === instance.value[CONTEXTS].length) {
          return undefined
        }

        return fixedInstance
      })
      .filter(values.isDefined)
      .toArray()

    const errors = fixedElements.map(instance => ({
      elemID: instance.elemID.createNestedID(CONTEXTS),
      severity: 'Info' as const,
      message: 'Deploying field without all attached contexts',
      detailedMessage:
        'This field contains contexts that do not reference any projects existing in the target environment. It will be deployed without referencing these contexts.',
    }))
    return { fixedElements, errors }
  }

export const fieldContextsHandler: WeakReferencesHandler = {
  findWeakReferences: getFieldsToContextsReferences,
  removeWeakReferences: removeContextsWithMissingProjects,
}
