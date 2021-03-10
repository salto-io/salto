/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Element, isInstanceElement, InstanceElement, getChangeElement, Change, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { isMetadataObjectType, metadataType, apiName } from '../transformers/transformer'
import { CONTENT_FILENAME_OVERRIDE } from '../transformers/xml_transformer'
import { TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE, TERRITORY2_RULE_TYPE } from '../constants'
import { isInstanceOfTypeChange, parentApiName } from './utils'

// territory2Model does not require another nested dir
const territory2TypesToNestedDirName: Record<string, string[]> = {
  [TERRITORY2_RULE_TYPE]: ['rules'],
  [TERRITORY2_TYPE]: ['territories'],
}

const territory2Types = [...Object.keys(territory2TypesToNestedDirName), TERRITORY2_MODEL_TYPE]

const removeCustomFieldsFromTypes = (elements: Element[], typeNames: string[]): void => {
  const elementsOfTypes = elements.filter(elem => typeNames.includes(metadataType(elem)))
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

const isTerritoryRelatedChange = (change: Change): change is Change<InstanceElement> => (
  isInstanceChange(change) && isAdditionOrModificationChange(change)
   && territory2Types.some(typeName => isInstanceOfTypeChange(typeName)(change))
)

const setTerritoryDeployPkgStructure = (element: InstanceElement): void => {
  const { suffix } = element.type.annotations
  const instanceName = apiName(element, true)
  const contentPath = [
    parentApiName(element),
    ...territory2TypesToNestedDirName[metadataType(element)] ?? [],
    `${instanceName}${suffix === undefined ? '' : `.${suffix}`}`,
  ]
  element.annotate({ [CONTENT_FILENAME_OVERRIDE]: contentPath })
}

const filterCreator: FilterCreator = () => ({
  onFetch: async elements => {
    // Territory2 and Territory2Model support custom fields - these are returned
    // in a CustomObject with the appropriate name and also in each instance of these types
    // We remove the fields from the instances to avoid duplication
    removeCustomFieldsFromTypes(elements, [TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE])
  },

  // territory2 types require a special deploy pkg structure (SALTO-1200)
  preDeploy: async changes => {
    changes
      .filter(isTerritoryRelatedChange)
      .map(getChangeElement)
      .forEach(setTerritoryDeployPkgStructure)
  },
  onDeploy: async changes => {
    changes
      .filter(isTerritoryRelatedChange)
      .map(getChangeElement)
      .forEach(elem => {
        delete elem.annotations[CONTENT_FILENAME_OVERRIDE]
      })
    return []
  },
})

export default filterCreator
