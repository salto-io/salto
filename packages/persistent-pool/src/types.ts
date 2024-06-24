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
import { retry } from '@salto-io/lowerdash'

export type InstanceId = string

export type RetryStrategy = retry.RetryStrategy

export type Lease<T = unknown> = {
  id: InstanceId
  value: T
}

export type UnavailableLease = {
  leaseExpiresBy: Date
  clientId: string
}

export type LeaseWithStatus<T> = Lease<T> &
  (
    | ({ status: 'suspended'; suspensionReason: string } & UnavailableLease)
    | ({ status: 'leased' } & UnavailableLease)
    | { status: 'available' }
  )

export type LeaseUpdateOpts = { validateClientId: boolean }

export const DEFAULT_LEASE_UPDATE_OPTS: LeaseUpdateOpts = Object.freeze({ validateClientId: true })

export type Pool<T = unknown> = AsyncIterable<LeaseWithStatus<T>> & {
  register(value: T, id?: InstanceId): Promise<InstanceId>
  unregister(id: InstanceId): Promise<void>
  suspend(id: InstanceId, reason: string, timeout: number, opts?: Partial<LeaseUpdateOpts>): Promise<void>
  lease(returnTimeout: number): Promise<Lease<T> | null>
  waitForLease(returnTimeout: number, retryStrategy: () => RetryStrategy): Promise<Lease<T>>
  updateTimeout(id: InstanceId, newTimeout: number, opts?: Partial<LeaseUpdateOpts>): Promise<void>
  return(id: InstanceId, opts?: Partial<LeaseUpdateOpts>): Promise<void>
  clear(): Promise<void>
}

export type RepoOpts = {
  clientId: string
}

export type Repo = {
  pool<T extends {}>(typeName: string): Promise<Pool<T>>
}

export type RepoMaker<TOpts extends RepoOpts> = (opts: TOpts) => Repo

export abstract class InstanceError extends Error {
  readonly id: string
  readonly typeName: string

  constructor({ id, typeName, message }: { id: InstanceId; typeName: string; message: string }) {
    super(`Instance "${id}" of type "${typeName}": ${message}`)
    this.id = id
    this.typeName = typeName
  }
}

export class InstanceIdAlreadyRegistered extends InstanceError {
  constructor({ id, typeName }: { id: InstanceId; typeName: string }) {
    super({ id, typeName, message: 'already exists' })
  }
}

export class InstanceNotFoundError extends InstanceError {
  constructor({ id, typeName }: { id: InstanceId; typeName: string }) {
    super({ id, typeName, message: 'not found' })
  }
}

export class InstanceNotLeasedError extends InstanceError {
  readonly clientId: string

  constructor({ id, typeName, clientId }: { id: InstanceId; typeName: string; clientId: string }) {
    super({ id, typeName, message: `not leased by client "${clientId}"` })
    this.clientId = clientId
  }
}
