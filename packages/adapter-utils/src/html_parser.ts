/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, hasChildren, isTag, isText, Node } from 'domhandler'
import { DomHandler, Parser } from 'htmlparser2'
import { logger } from '@salto-io/logging'
import { PotentialReference } from './template'

const log = logger(module)

const ELEMENTS_WITH_URLS: { [key: string]: string } = {
  a: 'href',
  area: 'href',
  img: 'src',
  link: 'href',
  script: 'src',
  source: 'src',
  track: 'src',
  form: 'action',
  video: 'poster',
}

// Function to extract the location of an attribute value in the content
// htmlparser2 does not provide the location of the attribute value in a node
const updateUrlLocations = (urls: PotentialReference<string>[], content: string): PotentialReference<string>[] =>
  urls.map(({ loc, value }) => {
    const start = loc.start + content.substring(loc.start, loc.end).indexOf(value)
    return { value, loc: { start, end: start + value.length } }
  })

const parseUrlTag = (node: Element): PotentialReference<string> | undefined => {
  if (node.name in ELEMENTS_WITH_URLS) {
    const urlAttr = ELEMENTS_WITH_URLS[node.name]
    if (!node.startIndex || !node.endIndex) {
      log.error('Missing start or end index for node %o', node)
      return undefined
    }
    if (node.attribs[urlAttr]) {
      return { value: node.attribs[urlAttr], loc: { start: node.startIndex, end: node.endIndex } }
    }
    if (node.attribs[`ng-${urlAttr}`]) {
      // Support AngularJS ng-href and ng-src
      return {
        value: node.attribs[`ng-${urlAttr}`],
        loc: { start: node.startIndex, end: node.endIndex },
      }
    }
  }
  return undefined
}

const parseScriptTag = (node: Element): PotentialReference<string> | undefined => {
  if (node.name === 'script') {
    // Assumes the first text child of a script tag is the script content
    const scriptContent = node.children.find(child => isText(child))
    if (scriptContent && isText(scriptContent)) {
      if (!scriptContent.startIndex || !scriptContent.endIndex) {
        log.error('Missing start or end index for node %o', node)
        return undefined
      }
      return {
        value: scriptContent.data,
        loc: { start: scriptContent.startIndex, end: scriptContent.endIndex },
      }
    }
  }
  return undefined
}

// Function to parse HTML and extract URLs from tags
export const parseTagsFromHtml = (
  htmlContent: string,
): { urls: PotentialReference<string>[]; scripts: PotentialReference<string>[] } => {
  const urls: PotentialReference<string>[] = []
  const scripts: PotentialReference<string>[] = []
  const handler = new DomHandler(
    (error, dom) => {
      if (error) {
        log.error(error)
      } else {
        const traverse = (nodes: Node[]): void => {
          nodes.forEach(node => {
            if (isTag(node)) {
              const url = parseUrlTag(node)
              if (url) {
                urls.push(url)
              }
              const script = parseScriptTag(node)
              if (script) {
                scripts.push(script)
              }
            }
            if (hasChildren(node)) {
              traverse(node.children)
            }
          })
        }
        traverse(dom)
      }
    },
    { withStartIndices: true, withEndIndices: true },
  )

  const parser = new Parser(handler)
  parser.write(htmlContent)
  parser.end()

  return { urls: updateUrlLocations(urls, htmlContent), scripts }
}
