/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import path from 'path'
import _ from 'lodash'
import {
  Element,
  isInstanceElement,
  InstanceElement,
  ObjectType,
  isObjectType,
  StaticFile,
  FetchResult,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { loadElementsFromFolder } from '../../src/sfdx_parser/sfdx_parser'
import {
  EMAIL_TEMPLATE_METADATA_TYPE,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
  METADATA_CONTENT_FIELD,
} from '../../src/constants'
import { apiName } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'
import { TMP_PROJECT_PATH } from './utils'

describe('loadElementsFromFolder', () => {
  describe('when called with valid project folder', () => {
    let elements: Element[]
    beforeAll(async () => {
      const elementsSource = buildElementsSourceFromElements(
        Object.values(_.omit(mockTypes, 'EmailTemplate', 'EmailFolder', 'Role')),
      )
      const loadElementsRes = await loadElementsFromFolder({
        baseDir: TMP_PROJECT_PATH,
        elementsSource,
      })
      elements = loadElementsRes.elements
    })
    describe('layout elements', () => {
      let layout: InstanceElement
      beforeAll(() => {
        ;[layout] = elements
          .filter(isInstanceElement)
          .filter(inst => inst.elemID.typeName === LAYOUT_TYPE_ID_METADATA_TYPE)
      })
      it('should load layout type elements', () => {
        expect(layout).toBeDefined()
      })
      it('should use file name as api name', async () => {
        expect(await apiName(layout)).toEqual('Test__c-Test Layout')
      })
    })
    describe('custom object', () => {
      let customObjectFragments: ObjectType[]
      beforeAll(() => {
        customObjectFragments = elements.filter(isObjectType).filter(obj => obj.elemID.typeName === 'Test__c')
      })
      it('should have fields', () => {
        const fields = customObjectFragments.flatMap(fragment => Object.keys(fragment.fields))
        expect(fields).toContainEqual('Check__c')
        expect(fields).toContainEqual('One__c')
      })
    })
    describe('type with content - apex class', () => {
      let apexClass: InstanceElement
      beforeAll(() => {
        ;[apexClass] = elements.filter(isInstanceElement).filter(inst => inst.elemID.typeName === 'ApexClass')
      })
      it('should have content as static file', () => {
        expect(apexClass.value.content).toBeInstanceOf(StaticFile)
      })
    })
    describe('complex type - lightning component bundle', () => {
      let componentBundle: InstanceElement
      beforeAll(() => {
        ;[componentBundle] = elements
          .filter(isInstanceElement)
          .filter(inst => inst.elemID.typeName === LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE)
      })
      it('should have static files', () => {
        expect(componentBundle.value.lwcResources.lwcResource).toBeObject()
        Object.values<{ source: StaticFile }>(componentBundle.value.lwcResources.lwcResource).forEach(resource => {
          expect(resource.source).toBeInstanceOf(StaticFile)
        })
      })
    })
    describe('types that do not exist in the workspace', () => {
      describe('simple type - role', () => {
        let role: InstanceElement
        beforeAll(() => {
          ;[role] = elements.filter(isInstanceElement).filter(inst => inst.elemID.typeName === 'Role')
        })
        it('should load instances of these types anyway', () => {
          expect(role).toBeDefined()
        })
      })
      describe('type with folders and content - email template', () => {
        let template: InstanceElement
        let folder: InstanceElement
        beforeAll(() => {
          ;[template] = elements
            .filter(isInstanceElement)
            .filter(inst => inst.elemID.typeName === EMAIL_TEMPLATE_METADATA_TYPE)
          ;[folder] = elements.filter(isInstanceElement).filter(inst => inst.elemID.typeName === 'EmailFolder')
        })
        it('should load the email folder', () => {
          expect(folder).toBeDefined()
          expect(folder.value).toHaveProperty('fullName', 'MyEmails')
        })
        it('should load template with its content', () => {
          expect(template).toBeDefined()
          expect(template.value).toHaveProperty('fullName', 'MyEmails/LeadChangedNumOfLocs')
          expect(template.value).toHaveProperty(METADATA_CONTENT_FIELD, expect.any(StaticFile))
        })
      })
    })
  })
  describe('when called with a folder that does not contain a project', () => {
    let result: FetchResult
    beforeEach(async () => {
      const elementsSource = buildElementsSourceFromElements(Object.values(mockTypes))
      result = await loadElementsFromFolder({
        baseDir: path.join(__dirname, 'no_such_folder'),
        elementsSource,
      })
    })
    it('should return an error saying there is no valid project', () => {
      expect(result.errors).toBeDefined()
      expect(result.errors).toContainEqual(expect.objectContaining({ message: 'Failed to load project' }))
    })
  })
})
