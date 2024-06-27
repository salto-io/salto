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
import { definitions } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { adjustCategoryObjectToCategoryId, adjustServiceIdToTopLevel, adjustSiteObjectToSiteId } from './utils'

/*
 * Adjust os or mobile configuration profile instance
 */
export const adjust: definitions.AdjustFunction = ({ value }) => {
  if (!values.isPlainRecord(value)) {
    throw new Error('Expected value to be a record')
  }
  ;[adjustCategoryObjectToCategoryId, adjustSiteObjectToSiteId, adjustServiceIdToTopLevel].forEach(fn => fn(value))
  return { value }
}
