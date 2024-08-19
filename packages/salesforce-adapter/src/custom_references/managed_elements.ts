/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ElemID, Element, ReferenceInfo } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { WeakReferencesHandler } from '../types'
import { getNamespaceSync, isStandardObjectSync } from '../filters/utils'
import { INSTALLED_PACKAGE_METADATA, SALESFORCE } from '../constants'

const log = logger(module)
const { isDefined } = values

const installedPackageReference = (element: Element): ReferenceInfo | undefined => {
  const namespace = getNamespaceSync(element)
  if (namespace === undefined) {
    return undefined
  }

  return {
    source: element.elemID,
    target: ElemID.fromFullNameParts([SALESFORCE, INSTALLED_PACKAGE_METADATA, 'instance', naclCase(namespace)]),
    type: 'strong',
  }
}

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const topLevelReferences = elements.map(element => installedPackageReference(element)).filter(isDefined)
  const fieldReferences = elements
    .filter(isStandardObjectSync)
    .flatMap(standardObject => Object.values(standardObject.fields))
    .map(field => installedPackageReference(field))
    .filter(isDefined)
  const references = topLevelReferences.concat(fieldReferences)

  log.debug(`Generated InstalledPackage instance custom references for ${references.length} elements.`)

  return references
}

export const managedElementsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
