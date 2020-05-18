import { TimerManager } from '@klasa/timer-manager';

import type { EventEmitter } from 'events';

/**
 * A filter for an EventIterator.
 */
export type EventIteratorFilter<V> = (value: V, collected: V[]) => boolean;

/**
 * Options to be passed to an EventIterator.
 */
export interface EventIteratorOptions<V> {
	/**
	 * The filter.
	 */
	filter?: EventIteratorFilter<V>;
	/**
	 * The timeout in ms before ending the EventIterator.
	 */
	idle?: number;
}

/**
 * An EventIterator, used for asynchronously iterating over received values.
 */
export abstract class EventIterator<V> implements AsyncIterableIterator<V> {

	/**
	 * The filter used to filter out values.
	 */
	public filter: EventIteratorFilter<V>;

	/**
	 * Whether or not the EventIterator has ended.
	 */
	#ended = false;

	/**
	 * The amount of idle time in ms before moving on.
	 */
	#idle?: number;

	/**
	 * The queue of received values.
	 */
	#queue: V[] = [];

	/**
	 * The amount of collected values.
	 */
	#collected = 0;

	/**
	 * The limit before ending the EventIterator.
	 */
	#limit: number;

	/**
	 * @param emitter The EventEmitter to listen to.
	 * @param event The event we're listening for to receives values from.
	 * @param limit The amount of values to receive before ending the iterator.
	 * @param options Any extra options.
	 */
	public constructor(public readonly emitter: EventEmitter, public event: string, limit: number, options: EventIteratorOptions<V> = {}) {
		this.#limit = limit;
		this.#idle = options.idle;
		this.filter = options.filter ?? ((): boolean => true);

		this.push = this.push.bind(this);
		this.emitter.on(this.event, this.push);
	}

	/**
	 * Whether or not the EventIterator has ended.
	 */
	public get ended(): boolean {
		return this.#ended;
	}

	/**
	 * Ends the EventIterator.
	 */
	public end(): void {
		if (this.#ended) return;
		this.#ended = true;
		this.emitter.off(this.event, this.push);
	}

	/**
	 * The next value that's received from the EventEmitter.
	 */
	public async next(): Promise<IteratorResult<V>> {
		if (this.#queue.length) return { done: false, value: this.#queue.shift() as V };
		if (this.ended) return { done: true, value: undefined as never };
		return new Promise<IteratorResult<V>>((resolve): void => {
			let idleTimer: NodeJS.Timer;

			if (this.#idle) {
				idleTimer = TimerManager.setTimeout(() => {
					this.end();
					resolve(this.next());
				}, this.#idle);
			}

			this.emitter.once(this.event, (): void => {
				if (idleTimer) TimerManager.clearTimeout(idleTimer);
				resolve(this.next());
			});
		});
	}

	/**
	 * The symbol allowing EventIterators to be used in for-await-of loops.
	 */
	public [Symbol.asyncIterator](): AsyncIterableIterator<V> {
		return this;
	}

	/**
	 * Pushes a value into the queue.
	 */
	protected push(value: V): void {
		if (this.filter(value, this.#queue.slice())) {
			this.#queue.push(value);
			if (++this.#collected >= this.#limit) this.end();
		}
	}

}