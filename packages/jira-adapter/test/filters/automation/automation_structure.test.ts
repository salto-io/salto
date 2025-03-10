/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  InstanceElement,
  ObjectType,
  toChange,
  getAllChangeData,
  ReferenceExpression,
  ElemID,
  isReferenceExpression,
  StaticFile,
  isStaticFile,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { getFilterParams } from '../../utils'
import automationStructureFilter from '../../../src/filters/automation/automation_structure'
import { createAutomationTypes } from '../../../src/filters/automation/types'
import { JIRA } from '../../../src/constants'
import { HTML_BODY_TEST } from '../../change_validators/automations/html_body_content.test'

describe('automationStructureFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let type: ObjectType
  let someType: ObjectType
  let instance: InstanceElement
  let ref: InstanceElement
  let statusim: InstanceElement[]
  let instanceAfterFetch: InstanceElement
  let changedInstance: InstanceElement

  beforeEach(async () => {
    filter = automationStructureFilter(getFilterParams()) as typeof filter

    type = createAutomationTypes().automationType

    instance = new InstanceElement('instance', type, {
      id: '111',
      trigger: {
        component: 'TRIGGER',
        type: 'jira.issue.event.trigger:created',
      },
      components: [
        {
          id: '0',
          component: 'ACTION',
          value: null,
          updated: 1234,
        },
        {
          id: '1',
          component: 'CONDITION',
          value: 'priority > Medium',
          updated: 1111,
        },
        {
          id: '2',
          component: 'CONDITION',
          value: {
            id: 'someId',
            linkType: 'inward:10003',
            value: '123',
          },
          updated: 1111,
        },
        {
          id: '3',
          component: 'CONDITION',
          value: {
            selectedFieldType: 'priority',
            comparison: 'NOT_ONE_OF',
            compareValue: {
              type: 'ID',
              multiValue: true,
              value: '["\\"123","234","345","a]"]',
            },
          },
        },
        {
          id: '4',
          component: 'CONDITION',
          value: {
            selectedFieldType: 'status',
            comparison: 'EQUALS',
            compareValue: {
              type: 'ID',
              multiValue: false,
              value: 'Done',
            },
          },
        },
        {
          id: '5',
          component: 'ACTION',
          value: {
            operations: [
              {
                fieldType: 'status',
                type: 'SET',
                value: {
                  type: 'NAME',
                  value: 'Done',
                },
              },
              {
                fieldType: 'status',
                type: 'SET',
                value: 'rawVal',
              },
            ],
          },
        },
        {
          id: '6',
          component: 'CONDITION',
          value: '',
          updated: 1111,
        },
        {
          id: '7',
          component: 'ACTION',
          type: 'jira.issue.delete.link',
          value: {
            linkTypes: [
              {
                id: '10003',
                direction: 'inward',
                name: 'Jira is fun',
              },
            ],
          },
        },
        {
          id: '8',
          component: 'CONDITION',
          type: 'jira.issue.hasAttachments',
          value: true,
          updated: 1111,
        },
        {
          id: '9',
          component: 'ACTION',
          type: 'jira.issue.outgoing.email',
          value: { body: HTML_BODY_TEST, mimeType: 'text/html' },
        },
        {
          id: '10',
          component: 'ACTION',
          type: 'jira.proforma.form.add.action',
          value: {
            templateFormsConfig: { projectId: 10010, templateFormIds: [1, 5] },
          },
        },
      ],
      projects: [
        {
          projectId: '3',
          projectTypeKey: 'key',
        },
        {
          projectTypeKey: 'key2',
        },
      ],
      ruleScope: {
        resources: ['ari:cloud:jira:a35ab846-aa6a-41c1-b9ca-40eb4e260dd8:project/3'],
      },
    })

    someType = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
    })

    ref = new InstanceElement('linkInstance', someType, {
      id: '10003',
      name: 'LinkTypeee',
    })

    statusim = [
      new InstanceElement('s1', someType, { id: '"123', name: 'S1' }),
      new InstanceElement('s1', someType, { id: '234', name: 'S1' }),
      new InstanceElement('s1', someType, { id: '345', name: 'S1' }),
    ]

    instanceAfterFetch = instance.clone()
    instanceAfterFetch.value.components[2].value.linkType = new ReferenceExpression(ref.elemID, ref.value.id)
    instanceAfterFetch.value.components[2].value.linkTypeDirection = 'inward'
    instanceAfterFetch.value.components[1].rawValue = 'priority > Medium'
    delete instanceAfterFetch.value.components[1].value
    const compareVal1 = instanceAfterFetch.value.components[3].value.compareValue
    instanceAfterFetch.value.components[3].value.compareFieldValue = _.clone(compareVal1)
    delete instanceAfterFetch.value.components[3].value.compareValue
    instanceAfterFetch.value.components[3].value.compareFieldValue.values = [
      new ReferenceExpression(statusim[0].elemID, statusim[0]),
      new ReferenceExpression(statusim[1].elemID, statusim[1]),
      new ReferenceExpression(statusim[2].elemID, statusim[2]),
      'a]',
    ]
    delete instanceAfterFetch.value.components[3].value.compareFieldValue.value
    const compareVal2 = instanceAfterFetch.value.components[4].value.compareValue
    instanceAfterFetch.value.components[4].value.compareFieldValue = _.clone(compareVal2)
    delete instanceAfterFetch.value.components[4].value.compareValue
    instanceAfterFetch.value.components[4].value.compareFieldValue.value = new ReferenceExpression(
      statusim[1].elemID,
      statusim[1],
    )
    const rawVal = instanceAfterFetch.value.components[5].value.operations[1].value
    instanceAfterFetch.value.components[5].value.operations[1].rawValue = rawVal
    delete instanceAfterFetch.value.components[5].value.operations[1].value

    instanceAfterFetch.value.components[6].rawValue = instanceAfterFetch.value.components[6].value
    delete instanceAfterFetch.value.components[6].value

    instanceAfterFetch.value.components[7].value.deleteLinkTypes =
      instanceAfterFetch.value.components[7].value.linkTypes
    delete instanceAfterFetch.value.components[7].value.linkTypes

    instanceAfterFetch.value.components[8].hasAttachmentsValue = instanceAfterFetch.value.components[8].value
    delete instanceAfterFetch.value.components[8].value

    instanceAfterFetch.value.components[9].value.body = new StaticFile({
      filepath: 'jira/Automation/instance.components.8.value.html',
      content: Buffer.from(HTML_BODY_TEST, 'utf8'),
    })

    changedInstance = instanceAfterFetch.clone()
    changedInstance.value.components[0].component = 'BRANCH'
  })

  describe('onFetch', () => {
    it('should remove null values', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].value).toBeUndefined()
    })

    it('should remove inner ids', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].id).toBeUndefined()
    })

    it('should not remove inner ids in components values', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[2].value.id).toBe('someId')
    })

    it('should remove redundant keys', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[0].updated).toBeUndefined()
    })

    it('should restructure projects value', async () => {
      await filter.onFetch([instance])
      expect(instance.value.projects).toEqual([
        {
          projectId: '3',
        },
      ])
    })

    it('should change value fields to rawValues only if value is strings', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[1].rawValue).toEqual('priority > Medium')
      expect(instance.value.components[1].value).toBeUndefined()
      expect(instance.value.components[2].rawValue).toBeUndefined()
      expect(instance.value.components[2].value).toBeObject()
      expect(instance.value.components[5].value.operations[1].value).toBeUndefined()
      expect(instance.value.components[5].value.operations[1].rawValue).toEqual('rawVal')
      expect(instance.value.components[6].value).toBeUndefined()
      expect(instance.value.components[6].rawValue).toEqual('')
    })

    it('should split linkType field', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[2].value.linkType).toEqual('10003')
      expect(instance.value.components[2].value.linkTypeDirection).toEqual('inward')
    })

    it('should restructure compareFieldValue', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[3].value.compareValue).toBeUndefined()
      expect(instance.value.components[3].value.compareFieldValue).toBeObject()
      expect(instance.value.components[3].value.compareFieldValue.values).toEqual(['"123', '234', '345', 'a]'])
      expect(instance.value.components[3].value.compareFieldValue.value).toBeUndefined()
      expect(instance.value.components[4].value.compareValue).toBeUndefined()
      expect(instance.value.components[4].value.compareFieldValue).toBeObject()
      expect(instance.value.components[4].value.compareFieldValue.value).toEqual('Done')
    })

    it('should rename linkTypes to deleteLinkTypes if in delete component', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[7].value.deleteLinkTypes).toEqual([
        {
          id: '10003',
          direction: 'inward',
          name: 'Jira is fun',
        },
      ])
      expect(instance.value.components[7].value.linkTypes).toBeUndefined()
    })

    it('should transform value to hasAttachmentsValue for components with type "jira.issue.hasAttachments"', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[8].value).toBeUndefined()
      expect(instance.value.components[8].hasAttachmentsValue).toBeTrue()
    })

    it('should make a new static file and replace the email content body to the static file path', async () => {
      await filter.onFetch([instance])
      expect(instance.value.components[9].value.body).toBeInstanceOf(StaticFile)
      expect(instance.value.components[9].value.body.filepath).toBe('jira/Automation/.html')
      expect(instance.value.components[9].value.body.internalContent).toBe(HTML_BODY_TEST)
    })
    it('static file name for html content should not be size limited', async () => {
      const longString = 'a'.repeat(3000)
      const longNamedInstance = new InstanceElement(longString, type)
      longNamedInstance.value = instance.value
      await filter.onFetch([longNamedInstance])
      expect(longNamedInstance.value.components[9].value.body).toBeInstanceOf(StaticFile)
      expect(longNamedInstance.value.components[9].value.body.filepath.length).toBeLessThan(255)
    })

    it('should transform the id type of a templateFormIds from number to string in jira.proforma.form.add.action', async () => {
      await filter.onFetch([instance])
      expect(Array.isArray(instance.value.components[10].value.templateFormsConfig.templateFormIds)).toBe(true)
      expect(instance.value.components[10].value.templateFormsConfig.templateFormIds).toEqual(
        expect.arrayContaining(['1', '5']),
      )
    })

    it('should not throw if wrong structure', async () => {
      const exceptionInstance = new InstanceElement('instance', type, {
        id: '111',
        components: [
          {
            id: '0',
            value: {
              compareValue: {
                multiValue: true,
                value: 'notAJson',
              },
            },
          },
        ],
      })
      await filter.onFetch([exceptionInstance])
      expect(exceptionInstance.value.components[0].value.compareFieldValue.value).toBeDefined()
    })

    describe('ruleScope', () => {
      let ruleScopeInstance: InstanceElement
      let globalScopeInstance: InstanceElement
      beforeEach(() => {
        ruleScopeInstance = new InstanceElement('instance', type, {
          projects: [],
          ruleScope: {
            resources: [
              'ari:cloud:jira:128baddc-c238-4857-b249-cfc84bd10c4b:project/10024',
              'ari:cloud:jira-software::site/128baddc-c238-4857-b249-cfc84bd10c4b',
              'ari:cloud:jira:128baddc-c238-4857-b249-cfc84bd10c4b:project/10034',
              'ari:cloud:jira-core::site/128baddc-c238-4857-b249-cfc84bd10c4b',
            ],
          },
        })
        globalScopeInstance = new InstanceElement('instance', type, {
          projects: [],
          ruleScope: {
            resources: ['ari:cloud:jira::site/128baddc-c238-4857-b249-cfc84bd10c4b'],
          },
        })
      })
      describe('when using Jira Cloud', () => {
        it('should covert rule scope to projects', async () => {
          await filter.onFetch([ruleScopeInstance])
          expect(ruleScopeInstance.value.projects).toEqual([
            {
              projectId: '10024',
            },
            {
              projectTypeKey: 'software',
            },
            {
              projectId: '10034',
            },
            {
              projectTypeKey: 'business',
            },
          ])
        })
        it('should covert global rule scope', async () => {
          await filter.onFetch([globalScopeInstance])
          expect(globalScopeInstance.value.projects).toBeUndefined()
        })
        it('should not covert if unknown project type', async () => {
          ruleScopeInstance.value.ruleScope.resources[1] =
            'ari:cloud:jira-none::site/128baddc-c238-4857-b249-cfc84bd10c4b'
          await filter.onFetch([ruleScopeInstance])
          expect(ruleScopeInstance.value.projects.length).toEqual(3)
        })
        it('should not covert if unknown resource', async () => {
          ruleScopeInstance.value.ruleScope.resources = ['ari:cloud:not-a--known-pattern']
          await filter.onFetch([ruleScopeInstance])
          expect(ruleScopeInstance.value.projects).toEqual([])
        })
      })
      describe('when using Jira DC', () => {
        beforeEach(async () => {
          filter = automationStructureFilter(getFilterParams(undefined, true)) as typeof filter
          globalScopeInstance.value.resources = undefined
          await filter.onFetch([globalScopeInstance])
        })
        it('should remove project list for global rules ', () => {
          expect(globalScopeInstance.value.projects).toBeUndefined()
        })
      })
    })
  })

  describe('preDeploy', () => {
    it('should combine linkType fields, change rawValue to value and rename deleteLinkTypes to linkTypes', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[1].value).toEqual('priority > Medium')
      expect(before.value.components[1].rawValue).toBeUndefined()
      expect(before.value.components[2].value.linkType).toEqual('inward:10003')
      expect(before.value.components[2].value.linkTypeDirection).toBeUndefined()
      expect(after.value.components[1].value).toEqual('priority > Medium')
      expect(after.value.components[1].rawValue).toBeUndefined()
      expect(after.value.components[2].value.linkType).toEqual('inward:10003')
      expect(after.value.components[2].value.linkTypeDirection).toBeUndefined()
      expect(after.value.components[5].value.operations[1].value).toEqual('rawVal')
      expect(after.value.components[5].value.operations[1].rawValue).toBeUndefined()
      expect(after.value.components[6].value).toEqual('')
      expect(after.value.components[6].rawValue).toBeUndefined()
      expect(after.value.components[7].value.deleteLinkTypes).toBeUndefined()
      expect(after.value.components[7].value.linkTypes).toEqual([
        {
          id: '10003',
          direction: 'inward',
          name: 'Jira is fun',
        },
      ])
      expect(after.value.components[8].value).toBeTrue()
      expect(after.value.components[8].hasAttachmentsValue).toBeUndefined()
    })
    it('should revert compare value structure to be deployable', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[3].value.compareFieldValue).toBeUndefined()
      expect(before.value.components[3].value.compareValue.value).toEqual('["\\"123","234","345","a]"]')
      expect(before.value.components[4].value.compareFieldValue).toBeUndefined()
      expect(before.value.components[4].value.compareValue.value).toEqual('234')
      expect(after.value.components[3].value.compareFieldValue).toBeUndefined()
      expect(after.value.components[3].value.compareValue.value).toEqual('["\\"123","234","345","a]"]')
      expect(after.value.components[4].value.compareFieldValue).toBeUndefined()
      expect(after.value.components[4].value.compareValue.value).toEqual('234')
    })
    it('should return the html content of an outgoing email to the body field', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[9].value.body).toBe(HTML_BODY_TEST)
      expect(after.value.components[9].value.body).toBe(HTML_BODY_TEST)
    })
  })

  describe('onDeploy', () => {
    it('should split linkType fields and change value to rawValue', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[1].value).toBeUndefined()
      expect(before.value.components[1].rawValue).toEqual('priority > Medium')
      expect(before.value.components[2].value.linkType).toBeInstanceOf(ReferenceExpression)
      expect(before.value.components[2].value.linkTypeDirection).toEqual('inward')
      expect(after.value.components[1].value).toBeUndefined()
      expect(after.value.components[1].rawValue).toEqual('priority > Medium')
      expect(after.value.components[2].value.linkType).toBeInstanceOf(ReferenceExpression)
      expect(after.value.components[2].value.linkTypeDirection).toEqual('inward')
      expect(after.value.components[5].value.operations[1].value).toBeUndefined()
      expect(after.value.components[5].value.operations[1].rawValue).toEqual('rawVal')
      expect(after.value.components[7].value.deleteLinkTypes).toEqual([
        {
          id: '10003',
          direction: 'inward',
          name: 'Jira is fun',
        },
      ])
      expect(after.value.components[7].value.linkTypes).toBeUndefined()
      expect(after.value.components[8].value).toBeUndefined()
      expect(after.value.components[8].hasAttachmentsValue).toBeTrue()
    })
    it('should change back compareFieldValue', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(before.value.components[3].value.compareValue).toBeUndefined()
      expect(before.value.components[3].value.compareFieldValue).toBeObject()
      expect(before.value.components[3].value.compareFieldValue.values.filter(isReferenceExpression)).toBeArrayOfSize(3)
      expect(before.value.components[3].value.compareFieldValue.value).toBeUndefined()
      expect(before.value.components[4].value.compareValue).toBeUndefined()
      expect(before.value.components[4].value.compareFieldValue).toBeObject()
      expect(before.value.components[4].value.compareFieldValue.value).toBeInstanceOf(ReferenceExpression)
      expect(after.value.components[3].value.compareValue).toBeUndefined()
      expect(after.value.components[3].value.compareFieldValue).toBeObject()
      expect(after.value.components[3].value.compareFieldValue.values.filter(isReferenceExpression)).toBeArrayOfSize(3)
      expect(after.value.components[3].value.compareFieldValue.value).toBeUndefined()
      expect(after.value.components[4].value.compareValue).toBeUndefined()
      expect(after.value.components[4].value.compareFieldValue).toBeObject()
      expect(after.value.components[4].value.compareFieldValue.value).toBeInstanceOf(ReferenceExpression)
    })
    it('should change back html body content to a static file with this html content as an internal content', async () => {
      const changes = [toChange({ before: instanceAfterFetch, after: changedInstance })]
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const [before, after] = getAllChangeData(changes[0])
      expect(isStaticFile(before.value.components[9].value.body)).toBe(true)
      expect(isStaticFile(after.value.components[9].value.body)).toBe(true)
      expect(after.value.components[9].value.body.internalContent).toBe(HTML_BODY_TEST)
    })
  })
})
