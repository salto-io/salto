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

import { Change, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import _ from 'lodash'
import JSZip from 'jszip'
import { client as clientUtils } from '@salto-io/adapter-components'
import { CONNECTION_TYPE, FOLDER_TYPE, RECIPE_TYPE, WORKATO } from '../src/constants'
import { RLMDeploy } from '../src/rlm'
import WorkatoClient from '../src/client/client'

describe('RLM functions', () => {
  describe('RLMDeploy', () => {
    const recipeType = new ObjectType({ elemID: new ElemID(WORKATO, RECIPE_TYPE,) })
    const connectionType = new ObjectType({ elemID: new ElemID(WORKATO, CONNECTION_TYPE) })
    const folderType = new ObjectType({ elemID: new ElemID(WORKATO, FOLDER_TYPE) })
    const connection = new InstanceElement('connectionInstanceName', connectionType, {
      id: 2222,
      application: 'test app',
      name: 'connection test name',
      folder_id: {
        folderParts: ['innerFolder'],
        rootId: 1111,
      },
    })
    const connection2 = new InstanceElement('connection2InstanceName', connectionType, {
      id: 4444,
      application: 'test app',
      name: 'connection2 test name',
      folder_id: {
        folderParts: ['innerFolder', 'SecondInnerFolder', 'ThirdInnerFolder'],
        rootId: 1111,
      },
    })
    const recipe = new InstanceElement('recipeInstanceName', recipeType, {
      id: 1,
      user_id: 11,
      name: 'recipe testName', // the space and CamelCase is for checking the halfSnakeCase which workato use
      trigger_application: 'adapter_name1',
      applications: ['adapter name'],
      description: 'When there is a trigger event, do action1',
      folder_id: {
        folderParts: [],
        rootId: 1111,
      },
      running: false,
      version_no: 1,
      config: [{
        keyword: 'application1',
        provider: 'test2 provider',
        skip_validation: false,
        name: 'test2 name',
        account_id: {
          id: 2222,
          application: 'test2 app',
          name: 'connection test2 name',
          folder_id: {
            folderParts: ['innerFolder'],
            rootId: 1111,
          },
        },
      }],
      code: {
        recipe_code: 'here should be the test2 code blocks and other parameters',
        block: [{ block1: 'block1 code test2' }, { block2: 'block2 code test2' }],
      },
    })
    const folder = new InstanceElement('folderInstanceName', folderType, {
      parent_id: {
        folderParts: ['Folder3'],
        rootId: 1111,
      },
      name: 'FolderInFolder3',
    })

    let changes : Change<InstanceElement>[]
    let mockGet: jest.SpyInstance
    let mockPost: jest.SpyInstance
    let client: WorkatoClient
    beforeEach(() => {
      client = new WorkatoClient({ credentials: { username: 'a', token: 'b' } })
    })

    describe('valid new connection', () => {
      beforeEach(() => {
        changes = [
          toChange({
            after: _.cloneDeep(connection),
          })]
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 200, data: { id: 3333 } })
        mockGet = jest.spyOn(client, 'getSinglePage')
        mockGet.mockResolvedValue({ status: 200, data: { status: 'completed' } })
      })
      it('should return valid deployResult', async () => {
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(1)
        expect(deployResult.errors).toHaveLength(0)
      })

      it('should get a zip with a connection, in workato RLM format', async () => {
        await RLMDeploy(changes, client)

        const zip = await JSZip.loadAsync(Buffer.from(mockPost.mock.calls[0][0].data))
        expect(_.keys(zip.files)).toHaveLength(2)
        expect(_.keys(zip.files)).toContain('innerFolder/')
        expect(_.keys(zip.files)).toContain('innerFolder/connection_test_name.connection.json')

        const folderToCheck = zip.files['innerFolder/'].async('string')
        const connectionFileToCheck = await zip.files['innerFolder/connection_test_name.connection.json'].async('string')
        expect(folderToCheck).toBeDefined()
        expect(connectionFileToCheck).toBeDefined()

        expect(JSON.parse(`{
          "name": "connection test name",
          "provider": "test app",
          "secure_gateway_tunnel_name": null,
          "root_folder": false
      }`)).toMatchObject(JSON.parse(connectionFileToCheck))
      })
    })


    describe('invalid connection modification', () => {
      beforeEach(() => {
        const connectionAfter = _.cloneDeep(connection)
        connectionAfter.value = _.omit(connectionAfter.value, 'application')
        changes = [
          toChange({
            before: new InstanceElement('connectionInstanceName', connectionType),
            after: connectionAfter,
          })]
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 200, data: { id: 3333 } })
        mockGet = jest.spyOn(client, 'getSinglePage')
        mockGet.mockResolvedValue({ status: 200, data: { status: 'completed' } })
      })
      it('should return error', async () => {
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].severity).toBe('Error')
        expect(deployResult.errors[0].message).toContain('connectionInstanceName')
        expect(deployResult.errors[0].message).toContain('invalid connection')
      })
    })


    describe('valid recipe modification', () => {
      beforeEach(() => {
        changes = [
          toChange({
            before: new InstanceElement('recipeInstanceName', recipeType),
            after: _.cloneDeep(recipe),
          })]
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 200, data: { id: 3333 } })
        mockGet = jest.spyOn(client, 'getSinglePage')
        mockGet.mockResolvedValue({ status: 200, data: { status: 'completed' } })
      })
      it('should return valid deployResult', async () => {
        const deployResult = await RLMDeploy(changes, client)
        // expect(deployResult.appliedChanges).toHaveLength(1)
        expect(deployResult.errors).toHaveLength(0)
      })

      it('should get a zip with a recipe, in workato RLM format', async () => {
        await RLMDeploy(changes, client)

        const zip = await JSZip.loadAsync(Buffer.from(mockPost.mock.calls[0][0].data))
        expect(_.keys(zip.files)).toHaveLength(1)
        expect(_.keys(zip.files)).toContain('recipe_testname.recipe.json')

        const recipeFileToCheck = await zip.files['recipe_testname.recipe.json'].async('string')
        expect(recipeFileToCheck).toBeDefined()

        const recipe1RLMFormatAnswer = `{
          "name": "recipe testName",
          "description": "When there is a trigger event, do action1",
          "version": 1,
          "private": true,
          "concurrency": 1,
          "code": {
            "recipe_code": "here should be the test2 code blocks and other parameters",
            "block": [
              { "block1": "block1 code test2" }, { "block2": "block2 code test2" }
            ]
          },
          "config": [
            {
              "keyword": "application1",
              "provider": "test2 provider",
              "skip_validation": false,
              "account_id": {
                "zip_name": "innerFolder/connection_test2_name.connection.json",
                "name": "connection test2 name",
                "folder": "innerFolder"
              }
            }
          ]
        }`
        expect(JSON.parse(recipe1RLMFormatAnswer)).toMatchObject(JSON.parse(recipeFileToCheck))
      })
    })

    describe('invalid new recipe', () => {
      beforeEach(() => {
        const recipeAfter = _.cloneDeep(recipe)
        recipeAfter.value.config[0].keyword = 1
        changes = [
          toChange({
            after: recipeAfter,
          })]
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 200, data: { id: 3333 } })
        mockGet = jest.spyOn(client, 'getSinglePage')
        mockGet.mockResolvedValue({ status: 200, data: { status: 'completed' } })
      })
      it('should return error', async () => {
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].severity).toBe('Error')
        expect(deployResult.errors[0].message).toContain('recipeInstanceName')
        expect(deployResult.errors[0].message).toContain('invalid recipe')
      })
    })

    describe('valid folder - non RLM object', () => {
      beforeEach(() => {
        changes = [
          toChange({
            after: _.cloneDeep(folder),
          })]
      })
      it('should return one error', async () => {
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].message).toContain('unknwon Types for RLM')
        expect(deployResult.errors[0].message).toContain('folderInstanceName')
        expect(deployResult.errors[0].message).toContain('type folder')
      })
    })
    describe('valid new recipe, new connection and connection modification and invalid recipe modification changes', () => {
      beforeEach(() => {
        const recipeAfter = _.cloneDeep(recipe)
        recipeAfter.value.config[0].account_id.name = { name: 'name' }

        changes = [
          toChange({
            before: new InstanceElement('connectionInstanceName', connectionType),
            after: _.cloneDeep(connection),
          }),
          toChange({
            after: _.cloneDeep(connection2),
          }),
          toChange({
            after: _.cloneDeep(recipe),
          }),
          toChange({
            before: new InstanceElement('recipeInstanceName', recipeType),
            after: recipeAfter,
          }),
        ]
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 200, data: { id: 3333 } })
        mockGet = jest.spyOn(client, 'getSinglePage')
        mockGet.mockResolvedValue({ status: 200, data: { status: 'completed' } })
      })
      it('should return valid deployResult', async () => {
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(3)
        expect(deployResult.errors).toHaveLength(1)

        expect(deployResult.errors[0].severity).toBe('Error')
        expect(deployResult.errors[0].message).toContain('recipeInstanceName')
        expect(deployResult.errors[0].message).toContain('invalid recipe')
      })
      it('should get a zip with a recipe and 2 connections, all in workato RLM format', async () => {
        await RLMDeploy(changes, client)

        const zip = await JSZip.loadAsync(Buffer.from(mockPost.mock.calls[0][0].data))
        expect(_.keys(zip.files)).toHaveLength(6)
        expect(_.keys(zip.files)).toContain('recipe_testname.recipe.json')
        expect(_.keys(zip.files)).toContain('innerFolder/')
        expect(_.keys(zip.files)).toContain('innerFolder/connection_test_name.connection.json')
        expect(_.keys(zip.files)).toContain('innerFolder/SecondInnerFolder/')
        expect(_.keys(zip.files)).toContain('innerFolder/SecondInnerFolder/ThirdInnerFolder/')
        expect(_.keys(zip.files)).toContain('innerFolder/SecondInnerFolder/ThirdInnerFolder/connection2_test_name.connection.json')


        const recipeFileToCheck = await zip.files['recipe_testname.recipe.json'].async('string')
        const folder1ToCheck = zip.files['innerFolder/'].async('string')
        const connectionFileToCheck = await zip.files['innerFolder/connection_test_name.connection.json'].async('string')
        const folder2ToCheck = zip.files['innerFolder/SecondInnerFolder/'].async('string')
        const folder3ToCheck = zip.files['innerFolder/SecondInnerFolder/ThirdInnerFolder/'].async('string')
        const connection2FileToCheck = await zip.files['innerFolder/SecondInnerFolder/ThirdInnerFolder/connection2_test_name.connection.json'].async('string')
        expect(recipeFileToCheck).toBeDefined()
        expect(folder1ToCheck).toBeDefined()
        expect(connectionFileToCheck).toBeDefined()
        expect(folder2ToCheck).toBeDefined()
        expect(folder3ToCheck).toBeDefined()
        expect(connection2FileToCheck).toBeDefined()
      })
    })

    describe('bad responses', () => {
      beforeEach(() => {
        changes = [
          toChange({
            after: _.cloneDeep(connection),
          })]
      })
      it('should raise HTTP Error while sending post to workato', async () => {
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockImplementation(() => {
          throw new clientUtils.HTTPError('http some error', {
            status: 502,
            data: { message: 'Bad Gateway' },
          })
        })
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].message).toContain('Bad Gateway')
      })
      it('should get Error response from workato server', async () => {
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 404, data: { message: 'API not found' } })
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].message).toContain('API not found')
        expect(deployResult.errors[0].message).toContain('404')
        expect(deployResult.errors[0].message).toContain('connection')
      })

      it('should raise HTTP Error whlie polling', async () => {
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 200, data: { id: 3333 } })
        mockGet = jest.spyOn(client, 'getSinglePage')
        mockGet.mockImplementation(() => {
          throw new clientUtils.HTTPError('Server Error', {
            status: 500,
            statusText: 'Server Error',
            data: {},
          })
        })
        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].message).toContain('Server Error')
        expect(deployResult.errors[0].message).toContain('500')
        expect(deployResult.errors[0].message).toContain('connection')
      })

      it('should get failed response from workato whlie polling', async () => {
        mockPost = jest.spyOn(client, 'post')
        mockPost.mockResolvedValue({ status: 200, data: { id: 3333 } })
        mockGet = jest.spyOn(client, 'getSinglePage')
        mockGet.mockResolvedValue({ status: 200, data: { status: 'failed', error: 'Bad Line' } })

        const deployResult = await RLMDeploy(changes, client)
        expect(deployResult.appliedChanges).toHaveLength(0)
        expect(deployResult.errors).toHaveLength(1)
        expect(deployResult.errors[0].message).toContain('Bad Line')
        expect(deployResult.errors[0].message).toContain('Deploy failed')
        expect(deployResult.errors[0].message).toContain('connection')
        expect(deployResult.errors[0].message).toContain('id: 3333')
      })
    })
  })
})
