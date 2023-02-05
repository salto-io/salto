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
import { Element, InstanceElement, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { FilterWith, LocalFilterCreator } from '../filter'
import { isCustomObject } from '../transformers/transformer'

const { awu } = collections.asynciterable

const getReferencedPackageNamesFromInstance = (instance: InstanceElement): Set<string> => {
  const referencedPackageNames = new Set<string>()
  console.log(instance)
  return referencedPackageNames
}


const addReferencedPackagesAnnotation = async (element: Element): Promise<void> => {
  if (isObjectType(element) && await isCustomObject(element)) {
    console.log('TODO')
  } else if (isInstanceElement(element)) {
    console.log('TODO')
  }
}

const filterCreator: LocalFilterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    await awu(elements).forEach(addReferencedPackagesAnnotation)
  },
})

export default filterCreator
