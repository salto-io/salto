/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { FixElementsFunc, Element, ChangeError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getEnabledEntries } from '../config_utils'

const { awu } = collections.asynciterable

const getFixedElements = (elements: Element[], fixedElements: Element[]): Element[] => {
  const elementIds = new Set(elements.map(element => element.elemID.getFullName()))

  const elementFixesByElemID = _.keyBy(fixedElements, element => element.elemID.getFullName())
  return elements
    .map(element => elementFixesByElemID[element.elemID.getFullName()] ?? element)
    .concat(fixedElements.filter(element => !elementIds.has(element.elemID.getFullName())))
}

/**
 * Combine several fixElements functions into one that will run the enabled ones.
 */
export const combineElementFixers =
  (fixersByName: Record<string, FixElementsFunc>, enabledFixers: Record<string, boolean> = {}): FixElementsFunc =>
  async elements => {
    const fixers = Object.values(getEnabledEntries(fixersByName, enabledFixers))
    return awu(fixers).reduce(
      async (allFixes, currentFixer) => {
        const updatedElements = getFixedElements(elements, allFixes.fixedElements)
        const newFixes = await currentFixer(updatedElements)
        return {
          fixedElements: getFixedElements(allFixes.fixedElements, newFixes.fixedElements),
          errors: allFixes.errors.concat(newFixes.errors),
        }
      },
      { fixedElements: [] as Element[], errors: [] as ChangeError[] },
    )
  }
