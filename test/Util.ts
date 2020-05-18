import ava from 'ava';
import { PeopleEmitter, people } from './lib/MockEmitter';
import { EventIterator } from '../dist';
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
	const iter = new PeopleEmitter().createPeopleIterator();
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
	const iter = new PeopleEmitter().createPeopleIterator(2);
	let count = 0;
	for await (const value of iter) {
		test.is(value, people[count++]);
	}
	test.is(count, 2);
});

// This test keeps failing and idk why.
ava('EventIterator properly filters values', async (test): Promise<void> => {
	const filter = (person: Person): boolean => person.name.length === 3;
	const filteredPeople = people.filter(filter);
	const iter = new PeopleEmitter().createPeopleIterator(filteredPeople.length, { filter });
	let count = 0;
	for await (const value of iter) {
		test.is(value, filteredPeople[count++]);
		if (count === filteredPeople.length - 1) break;
	}
});

ava('Timing out works', async (test): Promise<void> => {
	const iter = new PeopleEmitter().createPeopleIterator(people.length, { idle: 500 });
	for await (const __ of iter) {
		test.fail();
	}
	test.true(iter.ended);
});
