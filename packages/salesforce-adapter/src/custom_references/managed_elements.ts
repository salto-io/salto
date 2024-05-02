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

import { values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { ElemID, Element, ReferenceInfo } from '@salto-io/adapter-api'
import { WeakReferencesHandler } from '../types'
import {
  apiNameSync,
  getNamespaceSync,
  isInstanceOfTypeSync,
  isStandardObjectSync,
} from '../filters/utils'
import { INSTALLED_PACKAGE_METADATA } from '../constants'

const log = logger(module)
const { isDefined } = values

const installedPackageReference = (
  element: Element,
  installedPackageNamespaceToRef: Record<string, ElemID>,
): ReferenceInfo | undefined => {
  const namespace = getNamespaceSync(element)
  if (namespace === undefined) {
    return undefined
  }
  const installedPackageElemID = installedPackageNamespaceToRef[namespace]
  if (installedPackageElemID === undefined) {
    return undefined
  }
  return {
    source: element.elemID,
    target: installedPackageElemID,
    type: 'weak',
  }
}

const findWeakReferences: WeakReferencesHandler['findWeakReferences'] = async (
  elements: Element[],
): Promise<ReferenceInfo[]> => {
  const installedPackageNamespaceToRef: Record<string, ElemID> =
    Object.fromEntries(
      elements
        .filter(isInstanceOfTypeSync(INSTALLED_PACKAGE_METADATA))
        .map((packageMetadata: Element): [string | undefined, ElemID] => [
          apiNameSync(packageMetadata),
          packageMetadata.elemID,
        ])
        .filter(
          (keyVal: [string | undefined, ElemID]): keyVal is [string, ElemID] =>
            keyVal[0] !== undefined,
        ),
    )
  if (Object.keys(installedPackageNamespaceToRef).length === 0) {
    return []
  }

  const topLevelReferences = elements
    .map((element) =>
      installedPackageReference(element, installedPackageNamespaceToRef),
    )
    .filter(isDefined)
  const fieldReferences = elements
    .filter(isStandardObjectSync)
    .flatMap((standardObject) => Object.values(standardObject.fields))
    .map((field) =>
      installedPackageReference(field, installedPackageNamespaceToRef),
    )
    .filter(isDefined)
  const references = topLevelReferences.concat(fieldReferences)

  log.debug(
    `Generated InstalledPackage instance custom references for ${references.length} elements.`,
  )

  return references
}

export const managedElementsHandler: WeakReferencesHandler = {
  findWeakReferences,
  removeWeakReferences: () => async () => ({ fixedElements: [], errors: [] }),
}
