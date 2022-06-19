/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, ObjectType } from '@salto-io/adapter-api'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { collections, promises } from '@salto-io/lowerdash'
import { isObjectDef, isCustomField } from '../element_utils'
import { FilterCreator } from '../filter'
import { ZUORA_BILLING, OBJECTS_PATH } from '../constants'

export const annotationsFileName = (objectName: string): string => `${pathNaclCase(objectName)}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}CustomFields`

const { removeAsync } = promises.array
const getObjectDirectoryPath = (obj: ObjectType): string[] => (
  [ZUORA_BILLING, OBJECTS_PATH, pathNaclCase(obj.elemID.name)]
)

const objectDefToSplitPaths = (customObject: ObjectType): ObjectType => {
  const annotationsPath = [
    ...getObjectDirectoryPath(customObject),
    annotationsFileName(customObject.elemID.name),
  ]
  const standardFieldsPath = [
    ...getObjectDirectoryPath(customObject),
    standardFieldsFileName(customObject.elemID.name),
  ]
  const customFieldsPath = [
    ...getObjectDirectoryPath(customObject),
    customFieldsFileName(customObject.elemID.name),
  ]
  customObject.pathIndex = new collections.treeMap.TreeMap<string>([
    [customObject.elemID.getFullName(), annotationsPath],
    ...Object.values(customObject.fields)
      .map(field => [
        field.elemID.getFullName(),
        (isCustomField(field) ? customFieldsPath : standardFieldsPath),
      ] as [string, string[]]),
  ])
  return customObject
}

const filterCreator: FilterCreator = () => ({
  onFetch: async (elements: Element[]) => {
    const objectDefs = await removeAsync(elements, isObjectDef) as ObjectType[]
    const newSplitObjectDefs = objectDefs.map(objectDefToSplitPaths)
    elements.push(...newSplitObjectDefs)
  },
})

export default filterCreator
