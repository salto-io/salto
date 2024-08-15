/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
