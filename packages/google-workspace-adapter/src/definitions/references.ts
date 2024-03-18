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
import { definitions, references as referenceUtils } from '@salto-io/adapter-components'

const REFERENCE_RULES: referenceUtils.FieldReferenceDefinition<never>[] = [
  // {
  //   src: { field: 'serviceId', parentTypes: ['role__rolePrivileges', 'privilege__childPrivileges'] },
  //   serializationStrategy: 'serviceId',
  //   target: { type: 'privilege' },
  // },
  {
    src: { field: 'parentDomainName' },
    serializationStrategy: 'domainName',
    target: { type: 'domain' },
  },
]

export const REFERENCES: definitions.ApiDefinitions['references'] = {
  rules: REFERENCE_RULES,
}
