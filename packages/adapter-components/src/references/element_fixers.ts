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
import { FixElementsFunc, Element, ChangeError } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'

const { awu } = collections.asynciterable

const getFixedElements = (elements: Element[], fixedElements: Element[]): Element[] => {
  const elementIds = new Set(elements.map(element => element.elemID.getFullName()))

  const elementFixesByElemID = _.keyBy(fixedElements, element => element.elemID.getFullName())
  return elements
    .map(element => elementFixesByElemID[element.elemID.getFullName()] ?? element)
    .concat(fixedElements.filter(element => !elementIds.has(element.elemID.getFullName())))
}

/**
 * Combine several fixElements functions into one that will run all of them.
 */
export const combineElementFixers =
  (fixers: FixElementsFunc[]): FixElementsFunc =>
  async elements =>
    awu(fixers).reduce(
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
