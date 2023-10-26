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
import _ from 'lodash'
import {
  ElemID,
  Element,
  InstanceElement,
  isInstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  ArtificialTypes,
  CHANGED_AT_SINGLETON,
  CUSTOM_OBJECT,
  SALESFORCE,
} from '../../constants'

const DATA_INSTANCES_CHANGED_AT_MAGIC = '__DataInstances__'

export type ChangedAtInformation = {
  typeChangedAt: (metadataTypeName: string, typeName: string) => string | undefined
  typeInstancesChangedAt: (typeName: string) => string
  updateTypesChangedAt: (changedAtInfo: Record<string, Record<string, string>>) => void
  backingElement: () => Element
}

const createEmptyChangedAtSingletonInstance = async (): Promise<InstanceElement> => (
  new InstanceElement(
    ElemID.CONFIG_NAME,
    ArtificialTypes.ChangedAtSingleton,
  )
)

const getChangedAtSingleton = async (
  elementsSource: ReadOnlyElementsSource
): Promise<InstanceElement | undefined> => {
  const element = await elementsSource.get(new ElemID(SALESFORCE, CHANGED_AT_SINGLETON, 'instance', ElemID.CONFIG_NAME))
  return isInstanceElement(element) ? element : undefined
}

const getChangedAtSingletonInstance = async (
  elementsSource: ReadOnlyElementsSource
): Promise<InstanceElement> => {
  const changedAtSingleton = await getChangedAtSingleton(elementsSource)
  return changedAtSingleton ?? createEmptyChangedAtSingletonInstance()
}

export const createChangedAtInformation = async (
  elementsSource: ReadOnlyElementsSource
): Promise<ChangedAtInformation> => {
  const changedAtSingleton = await getChangedAtSingletonInstance(elementsSource)
  return {
    typeChangedAt: (metadataTypeName, typeName) => (
      _.get(changedAtSingleton.value, [metadataTypeName, typeName])
    ),
    typeInstancesChangedAt: typeName => (
      _.get(changedAtSingleton.value, [DATA_INSTANCES_CHANGED_AT_MAGIC, CUSTOM_OBJECT, typeName])
    ),
    updateTypesChangedAt: changedAtInfo => {
      changedAtSingleton.value = _.defaultsDeep(
        changedAtInfo,
        changedAtSingleton.value,
      )
    },
    backingElement: () => changedAtSingleton,
  }
}
