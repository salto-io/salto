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
import { MetadataInstance, MetadataParams, MetadataQueryParams } from './types'

export type MetadataQuery = {
  isTypeMatch: (type: string) => boolean
  isInstanceMatch: (instance: MetadataInstance) => boolean
}


export const buildMetadataQuery = ({ include = [], exclude = [] }: MetadataParams):
  MetadataQuery => {
  const isInstanceMatchQueryParams = (
    instance: MetadataInstance,
    {
      metadataType = '.*',
      // _namespace = '.*',
      name = '.*',
    }: MetadataQueryParams
  ): boolean =>
    new RegExp(metadataType).test(instance.metadataType)
    // && new RegExp(namespace).test(instance.namespace)
    && new RegExp(name).test(instance.name)

  return {
    isTypeMatch: type => (
      include.some(({ metadataType = '.*' }) => new RegExp(metadataType).test(type))
      && !exclude.some(({ metadataType = '.*', namespace = '.*', name = '.*' }) =>
        namespace === '.*' && name === '.*' && new RegExp(metadataType).test(type))
    ),

    isInstanceMatch: instance => (
      include.some(params => isInstanceMatchQueryParams(instance, params))
      && !exclude.some(params => isInstanceMatchQueryParams(instance, params))
    ),
  }
}
