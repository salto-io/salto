/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { InstanceElement, isInstanceElement, toChange } from '@salto-io/adapter-api'
import { getConfigRecordElements } from '../../src/client/config_elements'
import { CONFIG_RECORD_TYPES } from '../../src/types'
import filterCreator from '../../src/filters/config_elements'

describe('configElements filter', () => {
  const configType = CONFIG_RECORD_TYPES[0]
  const configRecord = {
    configType,
    fieldsDef: [
      {
        id: 'checkboxField',
        label: 'checkboxField',
        type: 'checkbox',
        selectOptions: [],
      },
      {
        id: 'integerField',
        label: 'integerField',
        type: 'integer',
        selectOptions: [],
      },
      {
        id: 'selectField',
        label: 'selectField',
        type: 'select',
        selectOptions: [{ value: '1', text: 'One' }],
      },
      {
        id: 'multiselectField',
        label: 'multiselectField',
        type: 'multiselect',
        selectOptions: [{ value: '1', text: 'One' }],
      },
      {
        id: 'emailField',
        label: 'emailField',
        type: 'email',
        selectOptions: [],
      },
      {
        id: 'textField',
        label: 'textField',
        type: 'text',
        selectOptions: [],
      },
    ],
    data: {
      fields: {
        checkboxField: 'T',
        integerField: '100',
        selectField: '1',
        multiselectField: '1\u00052',
        emailField: 'test@salto.io',
        textField: 'ignore',
      },
    },
  }
  const [originalInstance] = getConfigRecordElements([configRecord]).filter(isInstanceElement)

  let instance: InstanceElement
  beforeEach(() => {
    instance = originalInstance.clone()
  })

  describe('onFetch', () => {
    it('should transform instance values', async () => {
      await filterCreator().onFetch([instance])
      expect(instance.value).toEqual({
        configType,
        checkboxField: true,
        emailField: 'test@salto.io',
        integerField: 100,
        selectField: { text: 'One', value: '1' },
        multiselectField: [
          { text: 'One', value: '1' },
          { text: '', value: '2' },
        ],
      })
    })
    it('should not transform incorrect values', async () => {
      instance.value = {
        configRecord: {
          fieldsDef: [
            {
              id: 'checkboxField',
              label: 'checkboxField',
              type: 'checkbox',
              selectOptions: [],
            },
            {
              id: 'integerField',
              label: 'integerField',
              type: 'integer',
              selectOptions: [],
            },
            {
              id: 'emailField',
              label: 'emailField',
              type: 'email',
              selectOptions: [],
            },
          ],
          data: {
            fields: {
              checkboxField: 'TRUE',
              integerField: 'not_a_number',
              emailField: false,
            },
          },
        },
      }
      await filterCreator().onFetch([instance])
      expect(instance.value).toEqual({
        checkboxField: 'TRUE',
        emailField: false,
        integerField: 'not_a_number',
      })
    })
  })

  describe('preDeploy', () => {
    it('should transform instance values', async () => {
      instance.value = {
        configType,
        checkboxField: true,
        emailField: 'test@salto.io',
        integerField: 100,
        selectField: { text: 'One', value: '1' },
        multiselectField: [
          { text: 'One', value: '1' },
          { text: '', value: '2' },
        ],
        textField: 'do_not_ignore',
      }
      await filterCreator().preDeploy([toChange({ after: instance })])
      expect(instance.value).toEqual({
        configType,
        checkboxField: true,
        emailField: 'test@salto.io',
        integerField: 100,
        selectField: '1',
        multiselectField: '1\u00052',
        textField: 'do_not_ignore',
      })
    })
  })
})
