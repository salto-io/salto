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
import {
  ElemID,
  InstanceElement,
  isInstanceElement,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import {
  ArtificialTypes,
  CHANGED_AT_SINGLETON,
  SALESFORCE,
} from '../../constants'


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

export const getChangedAtSingletonInstance = async (
  elementsSource: ReadOnlyElementsSource | undefined
): Promise<InstanceElement> => {
  const changedAtSingleton = elementsSource !== undefined
    ? await getChangedAtSingleton(elementsSource)
    : undefined
  return changedAtSingleton ?? createEmptyChangedAtSingletonInstance()
}
