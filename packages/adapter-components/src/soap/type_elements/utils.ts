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
import { strings } from '@salto-io/lowerdash'
import _ from 'lodash'
import { Element as WsdlElement } from 'soap/lib/wsdl/elements'

export const searchInElement = (element: WsdlElement, types: string[]): WsdlElement[] => {
  const returnTypes = element.name && types.includes(element.name) ? [element] : []

  const childrenTypes = _.flatten(element.children?.map(e => searchInElement(e, types))) ?? []
  return [...returnTypes, ...childrenTypes]
}

export const convertToNamespaceName = (
  name: string,
  aliasToNamespace: Record<string, string>,
  camelCase: boolean,
  targetNamespace?: string,
): string => {
  const splittedName = name.split(':')
  const [namespaceAlias, realName] = splittedName.length === 2 ? splittedName : [undefined, splittedName[0]]

  const casedRealName = camelCase ? strings.lowerCaseFirstLetter(realName) : realName
  if (namespaceAlias !== undefined) {
    return `${aliasToNamespace[namespaceAlias]}|${casedRealName}`
  }

  if (targetNamespace !== undefined) {
    return `${targetNamespace}|${casedRealName}`
  }

  return casedRealName
}
