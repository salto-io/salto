import Fuse from 'fuse.js'
import _ from 'lodash'

import { isObjectType, Element } from 'adapter-api'

type ElementMap = Record<string, Element>
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
  exactMatchOnly: boolean = true,
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

export const findElement = (
  keyParts: string[],
  topLevelElements: ElementMap,
  searchElements: ElementMap,
  exactMatchOnly: boolean = true,
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
      ? findElement(
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
  elements: Element[]
): ElementMap => elements.reduce(
  (accumulator: ElementMap, element: Element) => {
    accumulator[element.elemID.getFullName()] = element
    return accumulator
  }, {}
)
