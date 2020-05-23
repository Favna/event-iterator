import ava from 'ava';
import { PeopleEmitter, people, sleep } from './lib/MockEmitter';
import { EventIterator } from '../src';
import type { Person } from './lib/Person';

ava('PeopleIterator is an instanceof EventIterator', (test): void => {
	test.true(new PeopleEmitter().createPeopleIterator() instanceof EventIterator);
});

ava('EventIterator#ended', (test): void => {
	test.plan(3);
	const iter = new PeopleEmitter().createPeopleIterator();
	test.false(iter.ended);
	iter.end();
	test.true(iter.ended);
	iter.end();
	test.true(iter.ended);
});

ava('EventIterator#next', async (test): Promise<void> => {
	test.plan(3);
	const iter = new PeopleEmitter().createPeopleIterator({ limit: people.length });
	const firstValue = await iter.next();
	test.deepEqual(firstValue, { done: false, value: people[0] });
	const secondValue = await iter.next();
	test.deepEqual(secondValue, { done: false, value: people[1] });
	iter.end();
	const thirdValue = await iter.next();
	test.deepEqual(thirdValue, { done: true, value: undefined });
});

ava('EventIterator ends when it hits it\'s limit', async (test): Promise<void> => {
	test.plan(3);

	const iter = new PeopleEmitter().createPeopleIterator({ limit: 2 });

	let count = 0;
	for await (const value of iter) {
		test.is(value, people[count++]);
	}
	test.is(count, 2);
});

ava('EventIterator properly filters values', async (test): Promise<void> => {
	test.plan(3);

	const filter = (person: Person): boolean => person.name.length === 3;
	const filteredPeople = people.filter(filter);
	const iter = new PeopleEmitter().createPeopleIterator({ limit: filteredPeople.length, filter });

	let count = 0;
	for await (const value of iter) {
		test.is(value, filteredPeople[count++]);
	}
	test.is(count, filteredPeople.length);
});

ava('EventIterator properly times out', async (test): Promise<void> => {
	const iter = new PeopleEmitter().createPeopleIterator({ idle: 500 });
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	for await (const __ of iter) {
		test.fail();
	}
	test.true(iter.ended);
});

ava('EventIterator timer properly idles out with iterations', async (test): Promise<void> => {
	test.plan(4);

	const iter = new PeopleEmitter().createPeopleIterator({ idle: 1200 });
	let count = 0;

	for await (const value of iter) {
		test.is(value, people[count++]);
	}

	test.is(count, 3);
});

ava('EventIterator properly increases listeners', (test): void => {
	test.plan(2);

	const emitter = new PeopleEmitter();
	emitter.setMaxListeners(1);
	const iter = emitter.createPeopleIterator();
	test.is(emitter.getMaxListeners(), 2);
	iter.end();
	test.is(emitter.getMaxListeners(), 1);
});

ava('EventIterator doesn\'t increase listener count when count is 0', (test): void => {
	test.plan(2);

	const emitter = new PeopleEmitter();
	emitter.setMaxListeners(0);
	const iter = emitter.createPeopleIterator();
	test.is(emitter.getMaxListeners(), 0);
	iter.end();
	test.is(emitter.getMaxListeners(), 0);
});

ava('EventIterator decreases count when loop is broken', async (test): Promise<void> => {
	test.plan(2);

	const emitter = new PeopleEmitter();
	emitter.setMaxListeners(1);
	const iter = emitter.createPeopleIterator();
	test.is(emitter.getMaxListeners(), 2);
	for await (const __ of iter) {
		break;
	}
	test.is(emitter.getMaxListeners(), 1);
});

ava('EventIterator decreases count when loop is thrown from', async (test): Promise<void> => {
	test.plan(2);

	const emitter = new PeopleEmitter();
	emitter.setMaxListeners(1);
	const iter = emitter.createPeopleIterator();
	test.is(emitter.getMaxListeners(), 2);

	try {
		for await (const __ of iter) {
			throw new Error('Ahhhhhhhhh');
		}
	} catch {
		// noop
	}

	test.is(emitter.getMaxListeners(), 1);
});

ava('EventIterator decreases count when some unknown internal throw happens', async (test): Promise<void> => {
	test.plan(2);

	const emitter = new PeopleEmitter();
	emitter.setMaxListeners(1);
	const iter = emitter.createPeopleIterator();
	test.is(emitter.getMaxListeners(), 2);

	await iter.throw();

	test.is(emitter.getMaxListeners(), 1);
});

ava('EventIterator doesn\'t have a next value after throwing', async (test): Promise<void> => {
	test.plan(4);
	const iter = new PeopleEmitter().createPeopleIterator();
	test.false(iter.ended);
	await sleep(3000);
	await iter.throw();
	test.true(iter.ended);
	const next = await iter.next();
	test.is(next.value, undefined);
	test.is(next.done, true);
});

ava('EventIterator doesn\'t have a next value after breaking', async (test): Promise<void> => {
	test.plan(4);
	const iter = new PeopleEmitter().createPeopleIterator();
	test.false(iter.ended);
	await sleep(3000);
	for await (const __ of iter) break;
	test.true(iter.ended);
	const next = await iter.next();
	test.is(next.value, undefined);
	test.is(next.done, true);
});
