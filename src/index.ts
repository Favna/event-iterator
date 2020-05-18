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
	 * The timeout for ending the EventIterator due to idling, if the option was passed.
	 */
	#idleTimer?: NodeJS.Timer;

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
		this.filter = options.filter ?? ((): boolean => true);

		this.push = this.push.bind(this);
		this.emitter.on(this.event, this.push);
		if (options.idle) this.#idleTimer = TimerManager.setTimeout(this.end.bind(this), options.idle);
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
			this.emitter.once(this.event, (): void => {
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
			if (this.#collected >= this.#limit) {
				this.end();
				return;
			}
			// eslint-disable-next-line no-unused-expressions
			this.#idleTimer?.refresh();
			this.#queue.push(value);
			this.#collected++;
		}
	}

}
