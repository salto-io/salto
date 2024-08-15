/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import _ from 'lodash'
import { elementSource } from '@salto-io/workspace'
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { ADAPTER_NAME, GROUP_TYPE_NAME, DOMAIN_TYPE_NAME } from '../../src/constants'
import { replaceGroupsDomainHandler } from '../../src/fix_elements/replace_groups_domain'
import { DEFAULT_CONFIG, UserConfig } from '../../src/config'

describe('replaceGroupsDomainHandler', () => {
  const config: UserConfig = DEFAULT_CONFIG
  const groupType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, GROUP_TYPE_NAME) })
  const domainType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, DOMAIN_TYPE_NAME) })
  const legitGroup = new InstanceElement('testGroup1', groupType, {
    email: 'testGroup1@legit.com',
    name: 'testGroup1',
  })
  const nonLegitGroup = new InstanceElement('testGroup2', groupType, {
    email: 'testGroup2@bla.com',
    name: 'testGroup2',
  })
  const primaryDomain = new InstanceElement('primaryDomain', domainType, {
    domainName: 'legit.com',
    isPrimary: true,
  })

  describe('default group is undefined', () => {
    it('should return an empty response', async () => {
      const response = await replaceGroupsDomainHandler({
        elementsSource: elementSource.createInMemoryElementSource([]),
        config,
      })([])
      expect(response).toEqual({ fixedElements: [], errors: [] })
    })
  })
  describe('default domain is ###PRIMARY###', () => {
    beforeEach(() => {
      _.set(config, 'deploy.defaultDomain', '###PRIMARY###')
    })

    describe('when there are no groups', () => {
      it('should return an empty response', async () => {
        const response = await replaceGroupsDomainHandler({
          elementsSource: elementSource.createInMemoryElementSource([]),
          config,
        })([])
        expect(response).toEqual({ fixedElements: [], errors: [] })
      })
    })
    describe('when the group has an existing domain', () => {
      it('should return an empty response', async () => {
        const response = await replaceGroupsDomainHandler({
          elementsSource: elementSource.createInMemoryElementSource([legitGroup, primaryDomain]),
          config,
        })([legitGroup])
        expect(response).toEqual({ fixedElements: [], errors: [] })
      })
    })
    describe('when the primary domain exists', () => {
      it('should replace the domain', async () => {
        const response = await replaceGroupsDomainHandler({
          elementsSource: elementSource.createInMemoryElementSource([nonLegitGroup, primaryDomain]),
          config,
        })([nonLegitGroup])
        const clone = nonLegitGroup.clone()
        clone.value.email = 'testGroup2@legit.com'
        expect(response.fixedElements).toEqual([clone])
        expect(response.errors[0].message).toEqual('Replaced the domain of group testGroup2 with legit.com.')
      })
    })
    describe('when the primary domain does not exist', () => {
      it('should return an Error', async () => {
        const response = await replaceGroupsDomainHandler({
          elementsSource: elementSource.createInMemoryElementSource([nonLegitGroup]),
          config,
        })([nonLegitGroup])
        expect(response).toEqual({
          fixedElements: [],
          errors: [],
        })
      })
    })
  })
  describe('default domain is not ###PRIMARY###', () => {
    beforeEach(() => {
      _.set(config, 'deploy.defaultDomain', 'super-legit.com')
    })

    it('should replace the domain', async () => {
      const response = await replaceGroupsDomainHandler({
        elementsSource: elementSource.createInMemoryElementSource([nonLegitGroup]),
        config,
      })([nonLegitGroup])
      const clone = nonLegitGroup.clone()
      clone.value.email = 'testGroup2@super-legit.com'
      expect(response.fixedElements).toEqual([clone])
      expect(response.errors[0].message).toEqual('Replaced the domain of group testGroup2 with super-legit.com.')
    })
  })
})
