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
import _ from 'lodash'
import { isInstanceElement, InstanceElement, getChangeElement } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'
import { apiName, metadataType } from '../transformers/transformer'
import { TERRITORY2_TYPE, TERRITORY2_MODEL_TYPE, TERRITORY2_RULE_TYPE } from '../constants'

const territory2TypesToNestedDirName: Record<string, string> = {
  [TERRITORY2_RULE_TYPE]: 'rules',
  [TERRITORY2_TYPE]: 'territories',
}

export const NESTED_DIR_NAMES_ANNOTATION = 'nestedDirs'
export const CONTENT_FILENAME_ANNOTATION = 'contentFileName'

const contentFileNameAnnotate = (elements: InstanceElement[], typeNames: string[]): void => {
  const elementsOfTypes = elements.filter(elem => typeNames.includes(metadataType(elem)))
  elementsOfTypes.forEach(element => {
    const nameWithoutModelPrefix = apiName(element).split('.').slice(1).join('.')
    const { suffix } = element.type.annotations
    const contentFileName = `${nameWithoutModelPrefix}${suffix === undefined ? '' : `.${suffix}`}`
    element.annotate({ [CONTENT_FILENAME_ANNOTATION]: contentFileName })
  })
}

const nestedDirsAnnotate = (elements: InstanceElement[], typeNames: string[]): void => {
  const elementsOfTypes = elements.filter(elem => typeNames.includes(metadataType(elem)))
  elementsOfTypes.forEach(element => {
    const modelName = apiName(element).split('.')[0]
    const nestedDirsNames = [modelName]

    if (territory2TypesToNestedDirName[metadataType(element)] !== undefined) {
      const nestedDirName = territory2TypesToNestedDirName[metadataType(element)]
      nestedDirsNames.push(nestedDirName)
    }
    element.annotate({ [NESTED_DIR_NAMES_ANNOTATION]: nestedDirsNames })
  })
}

const filterCreator: FilterCreator = () => ({
  // territory2 types require a special deploy pkg structure (SALTO-1200)
  preDeploy: async changes => {
    const instanceElements = changes.map(getChangeElement).filter(isInstanceElement)
    contentFileNameAnnotate(instanceElements, Object.keys(territory2TypesToNestedDirName))
    nestedDirsAnnotate(instanceElements,
      [...Object.keys(territory2TypesToNestedDirName), TERRITORY2_MODEL_TYPE])
  },
  onDeploy: async changes => {
    changes.map(getChangeElement).forEach(elem => {
      elem.annotations = _.omit(elem.annotations,
        [NESTED_DIR_NAMES_ANNOTATION, CONTENT_FILENAME_ANNOTATION])
    })
    return []
  },
})

export default filterCreator
