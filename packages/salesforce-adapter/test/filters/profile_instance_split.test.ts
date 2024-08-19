/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ObjectType, Element, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/profile_instance_split'
import { generateProfileType, defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('Profile Instance Split filter', () => {
  describe('Map profile instances', () => {
    const filter = filterCreator({
      config: defaultFilterContext,
    }) as FilterWith<'onFetch'>

    let profileObj: ObjectType
    let profileInstances: InstanceElement[]
    let elements: Element[]

    beforeAll(async () => {
      profileObj = generateProfileType(true)
      profileInstances = [
        new InstanceElement(
          'profile1',
          profileObj,
          {
            applicationVisibilities: {
              app1: { application: 'app1', default: true, visible: false },
              app2: { application: 'app2', default: true, visible: false },
            },
            fieldPermissions: {
              Account: {
                AccountNumber: {
                  field: 'Account.AccountNumber',
                  editable: true,
                  readable: true,
                },
              },
              Contact: {
                HasOptedOutOfEmail: {
                  field: 'Contact.HasOptedOutOfEmail',
                  editable: true,
                  readable: true,
                },
              },
            },
            layoutAssignments: {
              Account_Account_Layout: [{ layout: 'Account-Account Layout' }],
              Account_random_characters_aaa___bbb: [
                {
                  layout: 'Account-random characters %3B%2E%2B%3F%22aaa%27_%2B- bbb',
                  recordType: 'something',
                },
              ],
            },
            fullName: 'profile1',
            userLicense: 'Salesforce Platform',
          },
          ['salesforce', 'Records', 'Profile', 'profile1'],
        ),
        new InstanceElement(
          'profile2',
          profileObj,
          {
            fieldPermissions: {
              Account: {
                AccountNumber: {
                  field: 'Account.AccountNumber',
                  editable: true,
                  readable: true,
                },
              },
              Contact: {
                HasOptedOutOfEmail: {
                  field: 'Contact.HasOptedOutOfEmail',
                  editable: true,
                  readable: true,
                },
              },
            },
            fullName: 'profile2',
          },
          ['salesforce', 'Records', 'Profile', 'profile2'],
        ),
      ]

      elements = [profileObj, ...profileInstances.map(e => e.clone())]
      await filter.onFetch(elements)
    })
    it('should split each map field to its own path', () => {
      const profElements = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'profile1')
      expect(profElements).toHaveLength(4)

      const fieldsByPath = _.sortBy(
        profElements.map(e => [e.path?.join('/'), Object.keys(e.value).sort()]),
        item => item[0],
      )
      expect(fieldsByPath).toEqual([
        ['salesforce/Records/Profile/profile1/ApplicationVisibilities', ['applicationVisibilities']],
        ['salesforce/Records/Profile/profile1/Attributes', ['fullName', 'userLicense']],
        ['salesforce/Records/Profile/profile1/FieldPermissions', ['fieldPermissions']],
        ['salesforce/Records/Profile/profile1/LayoutAssignments', ['layoutAssignments']],
      ])
    })

    it('should only create elements for defined fields', () => {
      const profElements = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'profile2')
      expect(profElements).toHaveLength(2)

      const fieldsByPath = _.sortBy(
        profElements.map(e => [e.path?.join('/'), Object.keys(e.value).sort()]),
        item => item[0],
      )
      expect(fieldsByPath).toEqual([
        ['salesforce/Records/Profile/profile2/Attributes', ['fullName']],
        ['salesforce/Records/Profile/profile2/FieldPermissions', ['fieldPermissions']],
      ])
    })

    it('should have the default Attributes element first', () => {
      const profElements = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'profile1')
      expect(profElements[0].path?.slice(-1)[0]).toEqual('Attributes')
    })
  })
})
