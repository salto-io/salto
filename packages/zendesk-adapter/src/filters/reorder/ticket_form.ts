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
import { createReorderFilterCreator } from './creator'
import { TICKET_FORM_TYPE_NAME } from '../../constants'


/**
 * Add ticket forms order element with all the ticket forms ordered
 */
const filterCreator = createReorderFilterCreator({
  filterName: 'ticketFormOrderFilter',
  typeName: TICKET_FORM_TYPE_NAME,
  orderFieldName: 'ticket_form_ids',
  activeFieldName: 'active',
})

export default filterCreator
