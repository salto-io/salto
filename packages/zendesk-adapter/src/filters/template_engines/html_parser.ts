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
import { TemplateExpression } from '@salto-io/adapter-api'
import { extractTemplate } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Element, hasChildren, isTag, isText, Node } from 'domhandler'
import { DomHandler, Parser } from 'htmlparser2'
import { extractTemplateFromUrl, URL_REGEX } from '../article/utils'
import { PotentialReference, TemplateEngineOptions } from './types'

const log = logger(module)

// Regex for handlebar helper that may contain a reference to a URL.
// Assumes it's part of a string in an HTML attribute, which ends in a double quote.
// Example: <a href="{{help_center.url}}/hc/en-us/articles/360001234567">Link</a>
const HELP_CENTER_URL = /(\{\{help_center.url\}\}[^"]+)/

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

/*
 * Extracts potential references from a given string.
 * @param content - the string to extract the references from
 * @param urlBrandInstance - the brand instance to use for the URL reference
 * @param instancesById - a map of all instances by their ID
 * @param enableMissingReferences - whether to enable missing references
 */
export const parseUrlPotentialReferencesFromString = (
  content: string,
  { matchBrandSubdomain, idsToElements, enableMissingReferences }: TemplateEngineOptions,
): string | TemplateExpression =>
  extractTemplate(content, [URL_REGEX, HELP_CENTER_URL], expression => {
    if (expression.match(URL_REGEX)) {
      const urlBrandInstance = matchBrandSubdomain(expression)
      return urlBrandInstance !== undefined
        ? extractTemplateFromUrl({
            url: expression,
            urlBrandInstance,
            instancesById: idsToElements,
            enableMissingReferences,
          })
        : expression
    }
    return extractTemplateFromUrl({ url: expression, instancesById: idsToElements, enableMissingReferences })
  })

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

export const parseHtmlPotentialReferences = (
  content: string,
  { matchBrandSubdomain, idsToElements, enableMissingReferences }: TemplateEngineOptions,
): { urls: PotentialReference<string | TemplateExpression>[]; scripts: PotentialReference<string>[] } => {
  const { urls, scripts } = parseTagsFromHtml(content)
  return {
    urls: urls.map(url => ({
      value: parseUrlPotentialReferencesFromString(url.value, {
        matchBrandSubdomain,
        idsToElements,
        enableMissingReferences,
      }),
      loc: url.loc,
    })),
    scripts,
  }
}
