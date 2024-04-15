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
import { FetchResult, LoadElementsFromFolderArgs } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { allFilters } from './adapter'
import { createElementsSourceIndex } from './elements_source_index/elements_source_index'
import { parseSdfProjectDir } from './client/sdf_parser'
import { createElements } from './transformer'
import { netsuiteConfigFromConfig } from './config/config_creator'
import { TYPES_TO_SKIP } from './types'

const localFilters = allFilters.filter(filter.isLocalFilterCreator).map(({ creator }) => creator)

const loadElementsFromFolder = async (
  { baseDir, elementsSource, config, getElemIdFunc }: LoadElementsFromFolderArgs,
  filters = localFilters,
): Promise<FetchResult> => {
  const isPartial = true
  const filtersRunner = filter.filtersRunner(
    {
      elementsSourceIndex: createElementsSourceIndex(elementsSource, isPartial),
      elementsSource,
      isPartial,
      config: netsuiteConfigFromConfig(config),
    },
    filters,
  )
  const customizationInfos = await parseSdfProjectDir(baseDir)
  const elements = await createElements(
    customizationInfos.filter(custInfo => !TYPES_TO_SKIP.includes(custInfo.typeName)),
    getElemIdFunc,
  )
  await filtersRunner.onFetch(elements)

  return { elements }
}

export default loadElementsFromFolder
