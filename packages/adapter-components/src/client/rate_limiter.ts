/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import PQueue from 'p-queue'
import Bottleneck from 'bottleneck'
import { RATE_LIMIT_DEFAULT_OPTIONS } from './constants'

/**
 * Type for specifying retry options for the RateLimiter
 */
export type RateLimiterRetryOptions = {
  /**
   * Predicate to determine if a task should be retried based on the number of attempts and the error encountered.
   * @param numAttempts The current attempt number.
   * @param error The error encountered during the task execution.
   * @returns A boolean indicating whether the task should be retried.
   * @default () => false
   */
  retryPredicate: (numAttempts: number, error: Error) => boolean

  /**
   * Function to calculate the delay before retrying a task based on the number of attempts and the error encountered.
   * @param numAttempts The current attempt number.
   * @param error The error encountered during the task execution.
   * @returns The delay in milliseconds before the next retry.
   * @default () => 0
   */
  calculateRetryDelayMS: (numAttempts: number, error: Error) => number

  /**
   * Flag indicating whether to pause the queue for the delay calculated.
   * @default false
   */
  pauseDuringRetryDelay: boolean
}

/**
 * Type for specifying options for the RateLimiter.
 */
export type RateLimiterOptions = RateLimiterRetryOptions & {
  /**
   * The maximum number of concurrent calls allowed.
   * If set to 0 or a negative number, it will be treated as Infinity.
   * @default Infinity
   */
  maxConcurrentCalls: number

  /**
   * The maximum number of calls allowed per interval.
   * If set to 0 or a negative number, it will be treated as Infinity.
   * If intervalLengthMS is set to 0, this must be set to Infinity.
   * If set to a finite positive number, intervalLengthMS must be set to one as well.
   * @default Infinity
   */
  maxCallsPerInterval: number

  /**
   * The length of the interval in milliseconds.
   * If set to a negative number, it will be treated as 0.
   * If maxCallsPerInterval is Infinity, this must be set to 0.
   * If set to a finite positive number, maxCallsPerInterval must be set to one as well.
   * @default 0
   */
  intervalLengthMS: number

  /**
   * Whether running calls should be carried over into the next interval.
   * @default true
   */
  carryRunningCallsOver: boolean

  /**
   * The delay in milliseconds before a task is processed.
   * If set to 0 or a negative number, it will be treated as 0.
   * @default RATE_LIMIT_DEFAULT_DELAY_PER_REQUEST_MS
   */
  delayMS: number

  /**
   * Whether the queue should start in a paused state.
   * @default false
   */
  startPaused: boolean

  /**
   * Whether the underlying queue is Bottleneck or PQueue
   * @default true
   */
  useBottleneck: boolean
}

/**
 * Type for tracking the number of total, running, pending, and done tasks.
 */
export type RateLimiterCounters = {
  total: number
  running: number
  pending: number
  done: number
  succeeded: number
  failed: number
  retries: number
}

const toValidNumber = (defaultValue: number, value?: number): number =>
  value === undefined || value <= 0 ? defaultValue : value

/**
 * Class for managing rate limiting of tasks using PQueue or Bottleneck.
 */
export class RateLimiter {
  private queue: PQueue | Bottleneck
  private internalOptions: RateLimiterOptions
  private internalCounters: RateLimiterCounters
  private prevInvocationTime: number
  private resumeTimer: NodeJS.Timeout | undefined

  /**
   * Constructs a RateLimiter instance.
   * @param options Configuration options for the rate limiter.
   */
  constructor(options: Partial<RateLimiterOptions> = {}) {
    this.internalOptions = {
      maxConcurrentCalls: toValidNumber(RATE_LIMIT_DEFAULT_OPTIONS.maxConcurrentCalls, options.maxConcurrentCalls),
      delayMS: toValidNumber(RATE_LIMIT_DEFAULT_OPTIONS.delayMS, options.delayMS),
      maxCallsPerInterval: toValidNumber(RATE_LIMIT_DEFAULT_OPTIONS.maxCallsPerInterval, options.maxCallsPerInterval),
      intervalLengthMS: toValidNumber(RATE_LIMIT_DEFAULT_OPTIONS.intervalLengthMS, options.intervalLengthMS),
      carryRunningCallsOver: options.carryRunningCallsOver ?? RATE_LIMIT_DEFAULT_OPTIONS.carryRunningCallsOver,
      startPaused: options.startPaused ?? RATE_LIMIT_DEFAULT_OPTIONS.startPaused,
      useBottleneck: options.useBottleneck ?? RATE_LIMIT_DEFAULT_OPTIONS.useBottleneck,
      retryPredicate: options.retryPredicate ?? RATE_LIMIT_DEFAULT_OPTIONS.retryPredicate,
      calculateRetryDelayMS: options.calculateRetryDelayMS ?? RATE_LIMIT_DEFAULT_OPTIONS.calculateRetryDelayMS,
      pauseDuringRetryDelay: options.pauseDuringRetryDelay ?? RATE_LIMIT_DEFAULT_OPTIONS.pauseDuringRetryDelay,
    }

    if (
      (this.internalOptions.maxCallsPerInterval !== Infinity && this.internalOptions.intervalLengthMS === 0) ||
      (this.internalOptions.maxCallsPerInterval === Infinity && this.internalOptions.intervalLengthMS !== 0)
    ) {
      throw new Error(
        'When setting either maxCallsPerInterval or intervalLengthMS to a valid finite number bigger than 0, the other must be set as well.',
      )
    }

    if (
      this.internalOptions.useBottleneck &&
      (this.internalOptions.startPaused || this.internalOptions.pauseDuringRetryDelay)
    ) {
      throw new Error(
        "Bottleneck queue can't be paused and thus can't be initialized with startPaused==true or pauseDuringDelay==true.",
      )
    }

    this.queue = this.internalOptions.useBottleneck
      ? new Bottleneck({
          maxConcurrent:
            this.internalOptions.maxConcurrentCalls === Infinity ? null : this.internalOptions.maxConcurrentCalls,
          reservoir:
            this.internalOptions.maxCallsPerInterval === Infinity ? null : this.internalOptions.maxCallsPerInterval,
          reservoirRefreshInterval:
            this.internalOptions.intervalLengthMS === 0 ? null : this.internalOptions.intervalLengthMS,
          reservoirRefreshAmount:
            this.internalOptions.maxCallsPerInterval === Infinity ? null : this.internalOptions.maxCallsPerInterval,
        })
      : new PQueue({
          concurrency: this.internalOptions.maxConcurrentCalls,
          intervalCap: this.internalOptions.maxCallsPerInterval,
          interval: this.internalOptions.intervalLengthMS,
          carryoverConcurrencyCount: this.internalOptions.carryRunningCallsOver,
          autoStart: !this.internalOptions.startPaused,
        })

    this.internalCounters = {
      total: 0,
      running: 0,
      pending: 0,
      done: 0,
      succeeded: 0,
      failed: 0,
      retries: 0,
    }
    this.prevInvocationTime = Date.now()
    this.resumeTimer = undefined
  }

  /**
   * Returns a copy of the current configuration options of the rate limiter.
   * @returns The current configuration options.
   */
  get options(): RateLimiterOptions {
    return { ...this.internalOptions }
  }

  /**
   * Calculates the delay required to maintain the configured delay between task invocations.
   * It ensures that tasks are spaced out by at least the delay specified in the options.
   * @returns The calculated delay in milliseconds.
   */
  private nextDelay(): number {
    const currTime = Date.now()
    const timeSinceLastTask = currTime - this.prevInvocationTime
    const delay = Math.max(0, this.internalOptions.delayMS - timeSinceLastTask)
    this.prevInvocationTime = currTime + delay

    return delay
  }

  /**
   * Wraps a given task with a delay, ensuring that there is a pause between task invocations.
   * If a delay is specified in the options, it waits for the calculated delay before executing the task.
   * @param task The task to be wrapped and delayed.
   * @returns A function that returns a promise resolving to the result of the task.
   */
  private getDelayedTask<T>(task: () => Promise<T>): () => Promise<T> {
    const delayedTask = async (): Promise<T> => {
      if (this.internalOptions.delayMS > 0) {
        await new Promise(resolve => setTimeout(resolve, this.nextDelay()))
      }
      return task()
    }
    return delayedTask
  }

  /**
   * Wraps a given task with counters bookkeeping.
   * @param task The task to be wrapped with bookkeeping.
   * @returns A function that returns a promise resolving to the result of the task.
   */
  private wrapWithBookKeeping<T>(task: () => Promise<T>, isRetry: boolean = false): () => Promise<T> {
    return async (): Promise<T> => {
      this.internalCounters.pending -= 1
      this.internalCounters.running += 1
      if (isRetry) {
        this.internalCounters.retries += 1
      }
      try {
        const res = await task()
        this.internalCounters.succeeded += 1
        return res
      } catch (e) {
        this.internalCounters.failed += 1
        throw e
      } finally {
        this.internalCounters.running -= 1
        this.internalCounters.done += 1
      }
    }
  }

  /**
   * Wraps a task to pause the queue on failure if necessary.
   * @param task The task to be wrapped.
   * @param numAttempts The number of attempts made so far.
   * @returns A function that returns a promise resolving to the result of the task.
   */
  private wrapWithPauseOnFail<T>(task: () => Promise<T>, numAttempts: number): () => Promise<T> {
    return async () => {
      try {
        return await task()
      } catch (e) {
        const delay = this.internalOptions.calculateRetryDelayMS(numAttempts, e)
        if (delay > 0) {
          this.pause(delay)
        }
        throw e
      }
    }
  }

  /**
   * Recursively attempts to add a task to the queue, retrying if necessary.
   * @param task The task to be added.
   * @param numRetries The number of retry attempts made so far, defaults to 0.
   * @returns A promise that resolves when the task is completed.
   */
  private async recursiveAdd<T>(task: () => Promise<T>, numRetries: number = 0): Promise<T> {
    this.internalCounters.total += 1
    this.internalCounters.pending += 1
    const bookKeepingWrap = this.wrapWithBookKeeping(this.getDelayedTask(task), numRetries > 0)
    const wrappedTask = this.internalOptions.pauseDuringRetryDelay
      ? this.wrapWithPauseOnFail(bookKeepingWrap, numRetries)
      : bookKeepingWrap
    try {
      const res = this.internalOptions.useBottleneck
        ? (this.queue as Bottleneck).schedule(wrappedTask)
        : (this.queue as PQueue).add(wrappedTask)
      return await res
    } catch (e) {
      if (!this.internalOptions.retryPredicate(numRetries, e)) {
        throw e
      }

      if (!this.internalOptions.pauseDuringRetryDelay) {
        const delay = this.internalOptions.calculateRetryDelayMS(numRetries, e)
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      return this.recursiveAdd(task, numRetries + 1)
    }
  }

  /**
   * Adds a task to the queue. If a delay is configured in the options,
   * the task will be delayed by the specified amount of milliseconds.
   * @param task The task to be added to the queue.
   * @returns A promise that resolves when the task is completed.
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    return this.recursiveAdd(task)
  }

  /**
   * Adds multiple tasks to the queue.
   * @param tasks The tasks to be added to the queue.
   * @returns A promise that resolves when all tasks are completed.
   */
  addAll<T>(tasks: Array<() => Promise<T>>): Promise<T>[] {
    return tasks.map(task => this.add(task))
  }

  /**
   * Wraps an asynchronous function with the rate limiter.
   * @param fn The asynchronous function to be wrapped.
   * @returns The wrapped function.
   */
  wrap<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R> {
    return (...args: T) => this.add(() => fn(...args))
  }

  /**
   * Wraps multiple asynchronous functions with the rate limiter.
   * @param fns The asynchronous functions to be wrapped.
   * @returns The wrapped functions.
   */
  wrapAll<T extends unknown[], R>(fns: Array<(...args: T) => Promise<R>>): Array<(...args: T) => Promise<R>> {
    return fns.map(fn => this.wrap(fn))
  }

  /**
   * Retrieves the current statistics of the queue.
   * @returns An object containing the total, running, pending, and done task counts.
   */
  get counters(): RateLimiterCounters {
    return {
      ...this.internalCounters,
    }
  }

  /**
   * Pauses the processing of tasks in the queue.
   * If a duration is provided, the queue will automatically resume after the specified time.
   * This method is not supported when using Bottleneck as the underlying queue.
   * @param time The duration in milliseconds for which to pause the queue. If not provided, the queue will remain paused until `resume` is called.
   */
  pause(time?: number): void {
    if (this.queue instanceof Bottleneck) {
      throw new Error('RateLimiter has no implementation for pause when the underlying queue is Bottleneck')
    }
    this.queue.pause()
    if (time !== undefined) {
      clearTimeout(this.resumeTimer)
      this.resumeTimer = setTimeout(() => this.resume(), time)
    }
  }

  /**
   * Resumes the processing of tasks in the queue.
   */
  resume(): void {
    if (this.queue instanceof Bottleneck) {
      throw new Error('RateLimiter has no implementation for resume when the underlying queue is Bottleneck')
    }
    this.queue.start()
  }

  /**
   * Clears all pending tasks in the queue.
   */
  clear(): void {
    if (this.queue instanceof Bottleneck) {
      throw new Error('RateLimiter has no implementation for clear when the underlying queue is Bottleneck')
    }
    this.queue.clear()
    this.internalCounters.total -= this.internalCounters.pending
    this.internalCounters.pending = 0
  }
}
