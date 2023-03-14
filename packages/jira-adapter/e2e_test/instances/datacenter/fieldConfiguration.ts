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
import { Values, Element, ElemID } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA } from '../../../src/constants'

export const createFieldConfigurationValues = (
  name: string,
): Values => ({
  name,
  description: name,
})

export const createFieldConfigurationItemValues = (
  allElements: Element[],
): Values => ({
  id: createReference(new ElemID(JIRA, 'Field', 'instance', 'Component_s__array@duu'), allElements),
  description: 'For example operating system, software platform and/or hardware specifications (include as appropriate for the issue).',
  renderer: 'frother-control-renderer',
  isHidden: false,
  isRequired: false,
})
