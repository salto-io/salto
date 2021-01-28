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

import { FetchParameters } from '../types'
import { buildDataManagement, DataManagement } from './data_management'
import { buildMetadataQuery, MetadataQuery } from './metadata_query'

export type FetchProfile = {
  readonly metadataQuery: MetadataQuery
  readonly dataManagement?: DataManagement
}

export const buildFetchProfile = ({
  metadata = {},
  data,
}: FetchParameters): FetchProfile => (
  {
    metadataQuery: buildMetadataQuery(metadata),
    dataManagement: data && buildDataManagement(data),
  }
)
