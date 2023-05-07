/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, ElemID, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { collections, multiIndex } from '@salto-io/lowerdash'
import _ from 'lodash'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { INSTALLED_PACKAGE_METADATA } from '../constants'
import { buildElementsSourceForFetch, getNamespace, isInstanceOfType, isStandardObject } from './utils'
import { apiName } from '../transformers/transformer'

const { awu } = collections.asynciterable

const addInstalledPackageReference = async (
  element: Element,
  installedPackageNamespaceToRef: multiIndex.Index<[string], ElemID>
): Promise<void> => {
  const namespace = await getNamespace(element)
  if (namespace === undefined) {
    return
  }
  const installedPackageElemID = installedPackageNamespaceToRef.get(namespace)
  if (installedPackageElemID === undefined) {
    return
  }
  const reference = new ReferenceExpression(installedPackageElemID)
  extendGeneratedDependencies(element, [{ reference }])
}


const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'installedPackageGeneratedDependencies',
  local: true,
  onFetch: async (elements: Element[]) => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const installedPackageNamespaceToRef = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isInstanceOfType(INSTALLED_PACKAGE_METADATA),
      key: async inst => [await apiName(inst)],
      map: inst => inst.elemID,
    })
    if (_.isEmpty(Object.keys(installedPackageNamespaceToRef))) {
      return
    }
    await awu(elements)
      .forEach(element => addInstalledPackageReference(element, installedPackageNamespaceToRef))
    // CustomFields of Standard Objects
    await awu(elements)
      .filter(isObjectType)
      .filter(isStandardObject)
      .flatMap(standardObject => Object.values(standardObject.fields))
      .forEach(standardObject => addInstalledPackageReference(standardObject, installedPackageNamespaceToRef))
  },
})

export default filterCreator
