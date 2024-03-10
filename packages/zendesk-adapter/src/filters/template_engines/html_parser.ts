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
import { InstanceElement, TemplateExpression } from '@salto-io/adapter-api'
import { extractTemplate } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { hasChildren, isTag, isText, Node } from 'domhandler'
import { DomHandler, Parser } from 'htmlparser2'
import { extractTemplateFromUrl, URL_REGEX } from '../article/utils'
import { PotentialReference } from './types'

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
  {
    matchBrandSubdomain,
    instancesById,
    enableMissingReferences,
  }: {
    matchBrandSubdomain: (url: string) => InstanceElement | undefined
    instancesById: Record<string, InstanceElement>
    enableMissingReferences?: boolean
  },
): string | TemplateExpression =>
  extractTemplate(content, [URL_REGEX, HELP_CENTER_URL], expression => {
    if (expression.match(URL_REGEX)) {
      const urlBrandInstance = matchBrandSubdomain(expression)
      return urlBrandInstance !== undefined
        ? extractTemplateFromUrl({ url: expression, urlBrandInstance, instancesById, enableMissingReferences })
        : expression
    }
    return extractTemplateFromUrl({ url: expression, instancesById, enableMissingReferences })
  })

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
              if (node.name in ELEMENTS_WITH_URLS) {
                const urlAttr = ELEMENTS_WITH_URLS[node.name]
                if (node.attribs[urlAttr]) {
                  urls.push({ value: node.attribs[urlAttr], loc: { start: node.startIndex, end: node.endIndex } })
                } else if (node.attribs[`ng-${urlAttr}`]) {
                  // Support AngularJS ng-href and ng-src
                  urls.push({
                    value: node.attribs[`ng-${urlAttr}`],
                    loc: { start: node.startIndex, end: node.endIndex },
                  })
                }
              }
              if (node.name === 'script') {
                // Assumes the first text child of a script tag is the script content
                const scriptContent = node.children.find(child => isText(child))
                if (scriptContent && isText(scriptContent)) {
                  scripts.push({
                    value: scriptContent.data,
                    loc: { start: scriptContent.startIndex, end: scriptContent.endIndex },
                  })
                }
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

  return { urls, scripts }
}

export const parseHtmlPotentialReferences = (
  content: string,
  {
    matchBrandSubdomain,
    instancesById,
    enableMissingReferences,
  }: {
    matchBrandSubdomain: (url: string) => InstanceElement | undefined
    instancesById: Record<string, InstanceElement>
    enableMissingReferences?: boolean
  },
): { urls: PotentialReference<string | TemplateExpression>[]; scripts: PotentialReference<string>[] } => {
  const { urls, scripts } = parseTagsFromHtml(content)
  return {
    urls: urls.map(url => ({
      value: parseUrlPotentialReferencesFromString(url.value, {
        matchBrandSubdomain,
        instancesById,
        enableMissingReferences,
      }),
      loc: url.loc,
    })),
    scripts,
  }
}
