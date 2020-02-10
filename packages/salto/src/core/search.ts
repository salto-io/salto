/*
*                      Copyright 2020 Salto Labs Ltd.
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
import Fuse from 'fuse.js'
import _ from 'lodash'

import { isObjectType, Element } from 'adapter-api'

export type ElementMap = Record<string, Element>
type NotFound = null
type OptionalString = string | undefined

export interface FoundSearchResult {
  key: string
  element: Element
  isGuess: boolean
}

export type SearchResult = FoundSearchResult | NotFound

const getMatchingElementName = (
  searchWord: string,
  elementsNames: string[],
  exactMatchOnly = true,
): OptionalString => {
  const options = {
    shouldSort: true,
    threshold: exactMatchOnly ? 0 : 0.7,
    minMatchCharLength: exactMatchOnly
      ? searchWord.length
      : searchWord.length - 2,
  }
  const fuse = new Fuse(elementsNames, options)
  const matches = fuse.search(searchWord)
  return matches.length > 0 ? elementsNames[+matches[0]] : undefined
}

const findInnerElement = (
  keyParts: string[],
  topLevelElements: ElementMap,
  searchElements: ElementMap,
  exactMatchOnly = true,
): SearchResult => {
  const searchWord = keyParts[0]
  const keyPartsRem = keyParts.slice(1)
  const bestKey = getMatchingElementName(
    searchWord,
    Object.keys(searchElements),
    exactMatchOnly,
  )

  if (!bestKey) {
    return null
  }

  const bestElemId = searchElements[bestKey].elemID
  const bestElement = topLevelElements[bestElemId.getFullName()]
  const isGuess = bestKey !== searchWord
  if (!_.isEmpty(keyPartsRem)) {
    const res = isObjectType(bestElement)
      ? findInnerElement(
        keyPartsRem,
        topLevelElements,
        Object.assign({}, ...Object.values(bestElement.fields).map(f => ({ [f.name]: f.type }))),
        exactMatchOnly
      )
      : null

    return res
      ? {
        key: `${bestKey}.${res.key}`,
        element: res.element,
        isGuess: isGuess || res.isGuess,
      }
      : null
  }
  return { key: bestKey, element: bestElement, isGuess }
}

export const createElementsMap = (
  elements: readonly Element[]
): ElementMap => elements.reduce(
  (accumulator: ElementMap, element: Element) => {
    accumulator[element.elemID.getFullName()] = element
    return accumulator
  }, {}
)

export const findElement = (
  searchWords: string[],
  allElements: readonly Element[]
): SearchResult => {
  const elementsMap = createElementsMap(allElements)
  // First we try with exact match only
  return findInnerElement(searchWords, elementsMap, elementsMap)
  // Then we allow near matches
  || findInnerElement(searchWords, elementsMap, elementsMap, false)
}
