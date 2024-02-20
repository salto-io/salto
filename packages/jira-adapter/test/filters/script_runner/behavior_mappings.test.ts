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
import { filterUtils } from '@salto-io/adapter-components'
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import behaviorMappingsFilter from '../../../src/filters/script_runner/behaviors_mappings'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { BEHAVIOR_TYPE, JIRA, PROJECT_TYPE } from '../../../src/constants'

type FilterType = filterUtils.FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>

describe('behavior_mappings', () => {
  let filter: FilterType
  let instance: InstanceElement
  let behaviorType: ObjectType
  let issueType1: InstanceElement
  let issueType2: InstanceElement
  let issueType3: InstanceElement
  let issueTypeNoUse: InstanceElement
  let project1: InstanceElement
  let project2: InstanceElement
  beforeEach(() => {
    behaviorType = new ObjectType({
      elemID: new ElemID(JIRA, BEHAVIOR_TYPE),
      fields: {
        mappings: { refType: BuiltinTypes.BOOLEAN },
      },
    })
    const projectType = createEmptyType(PROJECT_TYPE)
    const issueTypes = createEmptyType('issueType')
    issueType1 = new InstanceElement('issueType1', issueTypes, {
      id: 'i1',
      name: 'issueType1',
    })
    issueType2 = new InstanceElement('issueType2', issueTypes, {
      id: 'i2',
      name: 'issueType2',
    })
    issueType3 = new InstanceElement('issueType3', issueTypes, {
      id: 'i3',
      name: 'issueType3',
    })
    issueTypeNoUse = new InstanceElement('issueTypeNoUse', issueTypes, {
      id: 'i4',
      name: 'issueTypeNoUse',
    })
    project1 = new InstanceElement('project1', projectType, {
      id: 'p1',
      name: 'project1',
    })
    project2 = new InstanceElement('project2', projectType, {
      id: 'p2',
      name: 'project2',
    })
    instance = new InstanceElement('instance', behaviorType, {})
  })
  describe('when script runner is enabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = true
      filter = behaviorMappingsFilter(getFilterParams({ config })) as FilterType
    })
    describe('onFetch', () => {
      beforeEach(() => {
        instance.value.mappings = {
          p1: ['i1', 'i2'],
          p2: ['i2', 'i3'],
        }
      })
      it('should convert from mappings to projects and issue types', async () => {
        await filter.onFetch([instance])
        expect(instance.value.projects).toEqual(['p1', 'p2'])
        expect(instance.value.issueTypes).toEqual(['i1', 'i2', 'i3'])
      })
      it('should add projects and issue types fields', async () => {
        await filter.onFetch([behaviorType])
        expect(behaviorType.fields.projects).toBeDefined()
        expect(behaviorType.fields.issueTypes).toBeDefined()
      })
      it('should remove mappings field', async () => {
        await filter.onFetch([behaviorType])
        expect(behaviorType.fields.mappings).toBeUndefined()
      })
    })
    describe('Deploy', () => {
      beforeEach(() => {
        const issueTypeScheme1 = new InstanceElement('issueTypeScheme', createEmptyType('issueTypeScheme'), {
          issueTypeIds: [
            new ReferenceExpression(issueType1.elemID, issueType1),
            new ReferenceExpression(issueType2.elemID, issueType2),
            new ReferenceExpression(issueTypeNoUse.elemID, issueTypeNoUse),
          ],
        })
        const issueTypeScheme2 = new InstanceElement('issueTypeScheme', createEmptyType('issueTypeScheme'), {
          issueTypeIds: [
            new ReferenceExpression(issueType2.elemID, issueType2),
            new ReferenceExpression(issueType3.elemID, issueType3),
            new ReferenceExpression(issueTypeNoUse.elemID, issueTypeNoUse),
          ],
        })
        project1.value.issueTypeScheme = new ReferenceExpression(issueTypeScheme1.elemID, issueTypeScheme1)
        project2.value.issueTypeScheme = new ReferenceExpression(issueTypeScheme2.elemID, issueTypeScheme2)
        instance.value.projects = [
          new ReferenceExpression(project1.elemID, project1),
          new ReferenceExpression(project2.elemID, project2),
        ]
        instance.value.issueTypes = [
          new ReferenceExpression(issueType1.elemID, issueType1),
          new ReferenceExpression(issueType2.elemID, issueType2),
          new ReferenceExpression(issueType3.elemID, issueType3),
        ]
      })
      it('should convert from projects and issue types to mappings', async () => {
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.mappings).toEqual({
          p1: ['i1', 'i2'],
          p2: ['i2', 'i3'],
        })
      })
      it('should remove projects and issue types fields', async () => {
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.projects).toBeUndefined()
        expect(instance.value.issueTypes).toBeUndefined()
      })
      it('should return issueTypes and Projects onDeploy', async () => {
        await filter.preDeploy([toChange({ after: instance })])
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.projects).toEqual([
          new ReferenceExpression(project1.elemID, project1),
          new ReferenceExpression(project2.elemID, project2),
        ])
        expect(instance.value.issueTypes).toEqual([
          new ReferenceExpression(issueType1.elemID, issueType1),
          new ReferenceExpression(issueType2.elemID, issueType2),
          new ReferenceExpression(issueType3.elemID, issueType3),
        ])
      })
      it('should delete mappings onDeploy', async () => {
        await filter.preDeploy([toChange({ after: instance })])
        await filter.onDeploy([toChange({ after: instance })])
        expect(instance.value.mappings).toBeUndefined()
      })
      it('should not fail when issueTypeScheme is not a reference', async () => {
        project1.value.issueTypeScheme = '45'
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.mappings).toEqual({
          p1: [],
          p2: ['i2', 'i3'],
        })
      })
      it('should not fail when issueTypeScheme does not have issueTypeIds', async () => {
        project1.value.issueTypeScheme = new ReferenceExpression(issueType1.elemID, issueType1)
        await filter.preDeploy([toChange({ after: instance })])
        expect(instance.value.mappings).toEqual({
          p1: [],
          p2: ['i2', 'i3'],
        })
      })
    })
  })
  describe('when script runner is disabled', () => {
    beforeEach(() => {
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      config.fetch.enableScriptRunnerAddon = false
      filter = behaviorMappingsFilter(getFilterParams({ config })) as FilterType
    })
    it('should not change the behavior type', async () => {
      await filter.onFetch([behaviorType])
      expect(behaviorType.fields.projects).toBeUndefined()
      expect(behaviorType.fields.issueTypes).toBeUndefined()
      expect(behaviorType.fields.mappings).toBeDefined()
    })
    it('should not change issueTypeIds on preDeploy when disabled', async () => {
      instance.value.issueTypes = ['issueType1', 'issueType2']
      await filter.preDeploy([toChange({ after: instance })])
      expect(instance.value.issueTypes).toEqual(['issueType1', 'issueType2'])
    })
    it('should not change issueTypeIds on onDeploy when disabled', async () => {
      instance.value.issueTypes = ['1', '2']
      await filter.onDeploy([toChange({ after: instance })])
      expect(instance.value.issueTypes).toEqual(['1', '2'])
    })
  })
})
