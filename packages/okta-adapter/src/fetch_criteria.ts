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
import { elements as elementUtils } from '@salto-io/adapter-components'
import { GROUP_TYPE_NAME } from './constants'

const oktaNameCriterion: elementUtils.query.QueryCriterion = ({ instance, value }): boolean =>
  instance.elemID.typeName === GROUP_TYPE_NAME
    ? elementUtils.query.fieldCriterionCreator('profile.name')({ instance, value })
    : elementUtils.query.nameCriterion({ instance, value })

export default {
  name: oktaNameCriterion,
  type: elementUtils.query.fieldCriterionCreator('type'),
  status: elementUtils.query.fieldCriterionCreator('status'),
}
