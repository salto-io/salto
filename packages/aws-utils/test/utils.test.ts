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
import * as AWS from '@aws-sdk/client-s3'
import { setupEnvVar } from '@salto-io/test-utils'
import { createS3Client, retryDecider } from '../src/utils'

describe('utils', () => {
  describe('createS3Client', () => {
    it('should create s3 client', () => {
      expect(createS3Client()).toBeInstanceOf(AWS.S3)
    })
    describe('when AWS_ENDPOINT_URL is configured', () => {
      setupEnvVar('AWS_ENDPOINT_URL', 'http://localhost:4566')
      it('should configure the endpoint and set forcePathStyle', async () => {
        const client = createS3Client()
        expect(client.config.forcePathStyle).toBeTruthy()
        await expect(client.config.endpoint()).resolves.toMatchObject({ hostname: 'localhost', port: 4566 })
      })
    })
    describe('when AWS_ENDPOINT_URL is not configured', () => {
      setupEnvVar('AWS_ENDPOINT_URL', undefined)
      it('should not set forcePathStyle', () => {
        const client = createS3Client()
        expect(client.config.forcePathStyle).toBeFalsy()
      })
    })
  })
  describe('retryDecider', () => {
    it('should return true for connection refused', () => {
      const err: Error & { code?: string } = new Error()
      err.code = 'ECONNREFUSED'
      expect(retryDecider(err)).toBeTruthy()
    })
    it('should return true for errors matching the default retry decider', () => {
      const err: Error & { code?: string } = new Error()
      err.code = 'ECONNRESET'
      expect(retryDecider(err)).toBeTruthy()
    })
    it('should return false for other errors', () => {
      const err = new Error()
      expect(retryDecider(err)).toBeFalsy()
    })
  })
})
