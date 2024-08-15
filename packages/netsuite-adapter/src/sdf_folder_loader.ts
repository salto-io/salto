/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
