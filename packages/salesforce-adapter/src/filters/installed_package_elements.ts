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
import { Element, InstanceElement, isInstanceElement, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { FilterWith } from '../filter'
import { INSTALLED_PACKAGE_METADATA } from '../constants'
import { getNamespace, isInstanceOfType, isStandardObject } from './utils'
import { apiName } from '../transformers/transformer'

const { awu, keyByAsync } = collections.asynciterable

const addInstalledPackageReference = async (
  element: Element,
  installedPackageInstanceByNamespace: Record<string, InstanceElement>
): Promise<void> => {
  const namespace = await getNamespace(element)
  if (namespace === undefined) {
    return
  }
  const installedPackageInstance = installedPackageInstanceByNamespace[namespace]
  if (installedPackageInstance === undefined) {
    return
  }
  const reference = new ReferenceExpression(installedPackageInstance.elemID, installedPackageInstance)
  extendGeneratedDependencies(element, [{ reference }])
}

const filterCreator = (): FilterWith<'onFetch'> => ({
  name: 'installedPackageElementsFilter',
  onFetch: async (elements: Element[]) => {
    const installedPackageInstanceByNamespace = await keyByAsync(
      await awu(elements)
        .filter(isInstanceElement)
        .filter(isInstanceOfType(INSTALLED_PACKAGE_METADATA))
        .toArray(),
      apiName,
    )
    if (_.isEmpty(Object.keys(installedPackageInstanceByNamespace))) {
      return
    }
    await awu(elements)
      .forEach(element => addInstalledPackageReference(element, installedPackageInstanceByNamespace))
    // CustomFields of Standard Objects
    await awu(elements)
      .filter(isObjectType)
      .filter(isStandardObject)
      .flatMap(standardObject => Object.values(standardObject.fields))
      .forEach(standardObject => addInstalledPackageReference(standardObject, installedPackageInstanceByNamespace))
  },
})

export default filterCreator
