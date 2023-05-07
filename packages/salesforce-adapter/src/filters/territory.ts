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
import { Element, isInstanceElement, InstanceElement, getChangeData, Change, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { LocalFilterCreator } from '../filter'
import { isMetadataObjectType, metadataType, apiName } from '../transformers/transformer'
import { CONTENT_FILENAME_OVERRIDE } from '../transformers/xml_transformer'
import { TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE, TERRITORY2_RULE_TYPE } from '../constants'
import { isInstanceOfTypeChange, parentApiName } from './utils'

const { awu } = collections.asynciterable
const { isDefined } = values

// territory2Model does not require another nested dir
const territory2TypesToNestedDirName: Record<string, string[]> = {
  [TERRITORY2_RULE_TYPE]: ['rules'],
  [TERRITORY2_TYPE]: ['territories'],
}

const territory2Types = [...Object.keys(territory2TypesToNestedDirName), TERRITORY2_MODEL_TYPE]

const removeCustomFieldsFromTypes = async (
  elements: Element[],
  typeNames: string[],
): Promise<void> => {
  const elementsOfTypes = elements
    .filter(async elem => typeNames.includes(await metadataType(elem)))
  elementsOfTypes
    .filter(isMetadataObjectType)
    .forEach(type => {
      delete type.fields.customFields
    })
  elementsOfTypes
    .filter(isInstanceElement)
    .forEach(inst => {
      delete inst.value.customFields
    })
}

const isTerritoryRelatedChange = async (
  change: Change,
): Promise<Change<InstanceElement> | undefined> => (
  (isInstanceChange(change) && isAdditionOrModificationChange(change)
   && await awu(territory2Types).some(typeName => isInstanceOfTypeChange(typeName)(change)))
    ? change
    : undefined
)

const setTerritoryDeployPkgStructure = async (element: InstanceElement): Promise<void> => {
  const { suffix } = (await element.getType()).annotations
  const instanceName = await apiName(element, true)
  const contentPath = [
    await parentApiName(element),
    ...territory2TypesToNestedDirName[await metadataType(element)] ?? [],
    `${instanceName}${suffix === undefined ? '' : `.${suffix}`}`,
  ]
  element.annotate({ [CONTENT_FILENAME_OVERRIDE]: contentPath })
}

const filterCreator: LocalFilterCreator = () => ({
  name: 'territoryFilter',
  onFetch: async elements => {
    // Territory2 and Territory2Model support custom fields - these are returned
    // in a CustomObject with the appropriate name and also in each instance of these types
    // We remove the fields from the instances to avoid duplication
    await removeCustomFieldsFromTypes(elements, [TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE])
  },

  // territory2 types require a special deploy pkg structure (SALTO-1200)
  preDeploy: async changes => {
    await awu(changes)
      .map(isTerritoryRelatedChange)
      .filter(isDefined)
      .map(getChangeData)
      .forEach(async elm => setTerritoryDeployPkgStructure(elm))
  },
  onDeploy: async changes => {
    await awu(changes)
      .map(isTerritoryRelatedChange)
      .filter(isDefined)
      .map(getChangeData)
      .forEach(elem => {
        delete elem.annotations[CONTENT_FILENAME_OVERRIDE]
      })
  },
})

export default filterCreator
