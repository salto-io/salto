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
  ReferenceInfo,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { PROJECT_IDS } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'
import { FIELD_CONTEXT_TYPE_NAME } from '../filters/fields/constants'

const { awu } = collections.asynciterable

const getContextReferences = (instance: InstanceElement): ReferenceInfo[] => {
  const contextProjects = instance.value[PROJECT_IDS]
  if (contextProjects === undefined || !Array.isArray(contextProjects)) {
    return []
  }

  return contextProjects
    .map((projRef, index) =>
      isReferenceExpression(projRef)
        ? {
            source: instance.elemID.createNestedID(PROJECT_IDS, index.toString()),
            target: projRef.elemID,
            type: 'weak' as const,
          }
        : undefined,
    )
    .filter(values.isDefined)
}

/**
 * Marks each project reference in context as a weak reference.
 */
const getContextsToProjectsReferences: GetCustomReferencesFunc = async elements =>
  elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .flatMap(getContextReferences)

/**
 * Remove invalid projects (not references or missing references) from contexts.
 */
export const removeMissingContextProjects =
  (changeInvalidContexts: boolean = true): WeakReferencesHandler['removeWeakReferences'] =>
  ({ elementsSource }) =>
  async elements => {
    const fixedElements = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .map(async instance => {
        const contextProjects = instance.value[PROJECT_IDS]
        if (contextProjects === undefined || !Array.isArray(contextProjects)) {
          return undefined
        }

        const fixedInstance = instance.clone()
        fixedInstance.value[PROJECT_IDS] = await awu(contextProjects)
          .filter(
            async proj =>
              !isReferenceExpression(proj) ||
              // eslint-disable-next-line no-return-await
              (await elementsSource.has(proj.elemID)),
          )
          .toArray()

        if (
          fixedInstance.value[PROJECT_IDS].length === instance.value[PROJECT_IDS].length ||
          // if all projects are missing, the context is invalid. We handle it in a change validator
          (fixedInstance.value[PROJECT_IDS].length === 0 && !changeInvalidContexts)
        ) {
          return undefined
        }

        return fixedInstance
      })
      .filter(values.isDefined)
      .toArray()

    const errors = fixedElements.map(instance => ({
      elemID: instance.elemID.createNestedID('projectIds'),
      severity: 'Info' as const,
      message: 'Deploying context without all attached projects',
      detailedMessage:
        'This context is attached to some projects that do not exist in the target environment. It will be deployed without referencing these projects.',
    }))
    return { fixedElements, errors }
  }

export const contextProjectsHandler: WeakReferencesHandler = {
  findWeakReferences: getContextsToProjectsReferences,
  removeWeakReferences: removeMissingContextProjects(false),
}
