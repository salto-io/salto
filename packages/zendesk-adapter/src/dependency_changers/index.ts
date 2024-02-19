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
import { DependencyChanger } from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { collections } from '@salto-io/lowerdash'
import { customFieldOptionDependencyChanger } from './custom_field_option_change'
import { orderDependencyChanger } from './order_change'
import { ticketFormDependencyChanger } from './ticket_form_change'
import { articleAttachmentDependencyChanger } from './article_attachment_change'
import { customObjectAndFieldDependencyChanger } from './custom_object_and_field_change'

const { awu } = collections.asynciterable

const DEPENDENCY_CHANGERS: DependencyChanger[] = [
  deployment.dependency.removeStandaloneFieldDependency,
  customFieldOptionDependencyChanger,
  orderDependencyChanger,
  ticketFormDependencyChanger,
  articleAttachmentDependencyChanger,
  customObjectAndFieldDependencyChanger,
]

export const dependencyChanger: DependencyChanger = async (changes, deps) =>
  awu(DEPENDENCY_CHANGERS)
    .flatMap(changer => changer(changes, deps))
    .toArray()
