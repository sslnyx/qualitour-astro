import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildItinerarySave,
  changedDayIds,
  dayId,
  readDays,
  updateDay,
} from '../src/plugins/tour-editor/tour-editor-model.ts';

const clone = (value) => JSON.parse(JSON.stringify(value));

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function day(key, overrides = {}) {
  return {
    _key: key,
    _type: 'day',
    title: `Title ${key}`,
    content: [
      {
        _type: 'block',
        _key: `${key}-p1`,
        style: 'normal',
        markDefs: [],
        children: [
          { _type: 'span', _key: `${key}-s1`, text: `Text ${key}`, marks: [] },
        ],
      },
    ],
    unknownBlockAttr: { nested: [`keep-${key}`] },
    ...overrides,
  };
}

function days(prefix, count, start = 1) {
  return Array.from({ length: count }, (_, i) => day(`${prefix}-${start + i}`));
}

function portableText() {
  return [
    {
      _type: 'block',
      _key: 'pt-1',
      style: 'normal',
      markDefs: [{ _key: 'link-1', _type: 'link', href: 'https://example.test/tour' }],
      children: [
        { _type: 'span', _key: 'pt-s1', text: 'Plain ', marks: [] },
        { _type: 'span', _key: 'pt-s2', text: 'bold link', marks: ['strong', 'link-1'] },
        { _type: 'span', _key: 'pt-s3', text: ' italic', marks: ['em'] },
      ],
    },
  ];
}

test('dayId is an unambiguous composite of field and key', () => {
  assert.equal(dayId({ field: 'itinerary', key: 'a' }), '["itinerary","a"]');
  assert.equal(
    dayId({ field: 'itinerary_continued', key: 'a' }),
    '["itinerary_continued","a"]',
  );
  assert.notEqual(
    dayId({ field: 'itinerary', key: 'a' }),
    dayId({ field: 'itinerary_continued', key: 'a' }),
  );
  // A key containing separator-like text cannot collide with another split.
  assert.notEqual(
    dayId({ field: 'itinerary', key: 'a","itinerary_continued' }),
    dayId({ field: 'itinerary_continued', key: 'a' }),
  );
});

test('readDays concatenates fields in order with continuous ordinals', () => {
  const data = {
    itinerary: days('a', 2),
    itinerary_continued: days('b', 2),
    otherTop: 'kept',
  };
  const rows = readDays(data);
  assert.deepEqual(
    rows.map((r) => [r.ref.field, r.ref.key, r.ordinal]),
    [
      ['itinerary', 'a-1', 1],
      ['itinerary', 'a-2', 2],
      ['itinerary_continued', 'b-1', 3],
      ['itinerary_continued', 'b-2', 4],
    ],
  );
  assert.equal(rows[0].block, data.itinerary[0]);
});

test('readDays treats absent and null fields as empty', () => {
  assert.deepEqual(readDays({}), []);
  assert.deepEqual(readDays({ itinerary: null, itinerary_continued: null }), []);
  assert.deepEqual(readDays({ itinerary: undefined }), []);
  assert.equal(readDays({ itinerary_continued: days('c', 1) }).length, 1);
});

test('readDays accepts totals of 0, 1, 16, 100, 101 and 200 across the two fields', () => {
  const cases = [
    [{}, 0],
    [{ itinerary: days('d', 1) }, 1],
    [{ itinerary: days('d', 10), itinerary_continued: days('e', 6) }, 16],
    [{ itinerary: days('d', 100) }, 100],
    [{ itinerary: days('d', 50), itinerary_continued: days('e', 50) }, 100],
    [{ itinerary: days('d', 100), itinerary_continued: days('e', 1) }, 101],
    [{ itinerary: days('d', 100), itinerary_continued: days('e', 100) }, 200],
  ];
  for (const [data, total] of cases) {
    assert.equal(readDays(data).length, total, `total ${total}`);
  }
});

test('readDays refuses more than 100 blocks in a single field', () => {
  assert.throws(() => readDays({ itinerary: days('d', 101) }), /at most 100/);
  assert.throws(
    () => readDays({ itinerary: days('d', 1), itinerary_continued: days('e', 101) }),
    /at most 100/,
  );
});

test('the same _key across the two fields is valid and selects correctly', () => {
  const data = {
    itinerary: [day('same', { title: 'First part' })],
    itinerary_continued: [day('same', { title: 'Second part' })],
  };
  assert.equal(readDays(data).length, 2);

  const editedSecond = updateDay(
    data,
    { field: 'itinerary_continued', key: 'same' },
    { title: 'Second edited' },
  );
  assert.equal(editedSecond.itinerary[0].title, 'First part');
  assert.equal(editedSecond.itinerary_continued[0].title, 'Second edited');

  const editedFirst = updateDay(
    data,
    { field: 'itinerary', key: 'same' },
    { title: 'First edited' },
  );
  assert.equal(editedFirst.itinerary[0].title, 'First edited');
  assert.equal(editedFirst.itinerary_continued[0].title, 'Second part');
  assert.equal(data.itinerary[0].title, 'First part');
  assert.equal(data.itinerary_continued[0].title, 'Second part');
});

test('readDays rejects a duplicate _key within one field', () => {
  assert.throws(
    () => readDays({ itinerary: [day('dup'), day('dup')] }),
    /Duplicate day _key "dup" in itinerary/,
  );
  assert.throws(
    () => readDays({ itinerary_continued: [day('x'), day('y'), day('x')] }),
    /Duplicate day _key "x" in itinerary_continued/,
  );
});

test('readDays rejects missing, empty and non-string _key values instead of dropping them', () => {
  const missing = day('gone');
  delete missing._key;
  assert.throws(() => readDays({ itinerary: [missing] }), /non-empty string _key/);
  assert.throws(() => readDays({ itinerary: [day('')] }), /non-empty string _key/);
  assert.throws(
    () => readDays({ itinerary: [{ _key: 7, _type: 'day' }] }),
    /non-empty string _key/,
  );
  assert.throws(() => readDays({ itinerary: [null] }), /must be an object/);
  assert.throws(() => readDays({ itinerary: ['day-1'] }), /must be an object/);
});

test('readDays rejects non-array fields', () => {
  assert.throws(() => readDays({ itinerary: 'not-an-array' }), /"itinerary" must be an array/);
  assert.throws(
    () => readDays({ itinerary_continued: { 0: day('a') } }),
    /"itinerary_continued" must be an array/,
  );
});

test('readDays rejects invalid _type, title and content instead of dropping them', () => {
  assert.throws(
    () => readDays({ itinerary: [day('a', { _type: 'hotel' })] }),
    /_type "day"/,
  );
  const noType = day('a');
  delete noType._type;
  assert.throws(() => readDays({ itinerary: [noType] }), /_type "day"/);
  assert.throws(
    () => readDays({ itinerary: [day('a', { title: 42 })] }),
    /title.*string/,
  );
  assert.throws(
    () => readDays({ itinerary: [day('a', { content: 'text' })] }),
    /content.*array/,
  );
  assert.throws(
    () => readDays({ itinerary: [day('a', { content: null })] }),
    /content.*array/,
  );
});

test('readDays allows blocks without title or content', () => {
  const bare = { _key: 'bare', _type: 'day', extra: 1 };
  const rows = readDays({ itinerary: [bare] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].block.extra, 1);
});

test('updateDay changes only Day 8 content; every other top-level and block value is unchanged', () => {
  const base = {
    _id: 'tour-1',
    title: 'Tour title',
    slug: { current: 'tour-one' },
    unknownTop: { keep: [1, 2, 3] },
    itinerary: days('day', 16),
    itinerary_continued: days('cont', 2),
  };
  const snapshot = clone(base);
  const newContent = portableText();

  const changed = updateDay(
    base,
    { field: 'itinerary', key: 'day-8' },
    { content: newContent },
  );

  assert.deepEqual(base, snapshot, 'input must not be mutated');
  assert.notEqual(changed, base);
  assert.equal(changed._id, 'tour-1');
  assert.equal(changed.title, 'Tour title');
  assert.deepEqual(changed.slug, { current: 'tour-one' });
  assert.deepEqual(changed.unknownTop, { keep: [1, 2, 3] });
  assert.deepEqual(changed.itinerary_continued, snapshot.itinerary_continued);

  changed.itinerary.forEach((block, i) => {
    if (block._key === 'day-8') {
      assert.deepEqual(block.content, newContent);
      assert.equal(block.title, snapshot.itinerary[i].title);
      assert.deepEqual(block.unknownBlockAttr, snapshot.itinerary[i].unknownBlockAttr);
    } else {
      assert.deepEqual(block, snapshot.itinerary[i], `block ${block._key} unchanged`);
    }
  });
  assert.deepEqual(changedDayIds(base, changed), ['["itinerary","day-8"]']);
});

test('updateDay preserves mixed PortableText marks and markDefs exactly', () => {
  const content = portableText();
  const base = { itinerary: [day('only')] };
  const changed = updateDay(base, { field: 'itinerary', key: 'only' }, { content });
  assert.deepEqual(changed.itinerary[0].content, portableText());
  assert.deepEqual(changed.itinerary[0].content[0].children[1].marks, ['strong', 'link-1']);
  assert.deepEqual(changed.itinerary[0].content[0].markDefs, [
    { _key: 'link-1', _type: 'link', href: 'https://example.test/tour' },
  ]);
});

test('updateDay does not mutate a deeply frozen input', () => {
  const base = deepFreeze({
    meta: { keep: true },
    itinerary: days('f', 3),
    itinerary_continued: days('g', 1),
  });
  const changed = updateDay(
    base,
    { field: 'itinerary', key: 'f-2' },
    { title: 'Frozen edit', content: portableText() },
  );
  assert.equal(changed.itinerary[1].title, 'Frozen edit');
  assert.deepEqual(changed.itinerary[1].content, portableText());
  assert.equal(base.itinerary[1].title, 'Title f-2');
  assert.equal(changed.itinerary[0].title, 'Title f-1');
});

test('updateDay accepts an empty title and leaves content untouched', () => {
  const base = { itinerary: [day('a')] };
  const before = clone(base.itinerary[0].content);
  const changed = updateDay(base, { field: 'itinerary', key: 'a' }, { title: '' });
  assert.equal(changed.itinerary[0].title, '');
  assert.deepEqual(changed.itinerary[0].content, before);
});

test('updateDay with an empty patch returns an equal but new value', () => {
  const base = { itinerary: [day('a')], other: 1 };
  const changed = updateDay(base, { field: 'itinerary', key: 'a' }, {});
  assert.deepEqual(changed, base);
  assert.notEqual(changed, base);
});

test('updateDay rejects patch keys beyond title and content at runtime', () => {
  const base = { itinerary: [day('a')] };
  const ref = { field: 'itinerary', key: 'a' };
  assert.throws(() => updateDay(base, ref, { slug: 'x' }), /Unsupported patch field "slug"/);
  assert.throws(
    () => updateDay(base, ref, { title: 'Ok', _key: 'other' }),
    /Unsupported patch field "_key"/,
  );
  assert.throws(() => updateDay(base, ref, { _type: 'day' }), /Unsupported patch field/);
  assert.throws(() => updateDay(base, ref, null), /Patch must be an object/);
  assert.throws(() => updateDay(base, ref, []), /Patch must be an object/);
});

test('updateDay rejects invalid patch value types', () => {
  const base = { itinerary: [day('a')] };
  const ref = { field: 'itinerary', key: 'a' };
  assert.throws(() => updateDay(base, ref, { title: 3 }), /title.*string/);
  assert.throws(() => updateDay(base, ref, { title: null }), /title.*string/);
  assert.throws(() => updateDay(base, ref, { content: 'x' }), /content.*array/);
  assert.throws(() => updateDay(base, ref, { content: null }), /content.*array/);
});

test('updateDay rejects a missing reference, including a key that only exists in the other field', () => {
  const base = {
    itinerary: [day('only-here')],
    itinerary_continued: [day('other')],
  };
  assert.throws(
    () => updateDay(base, { field: 'itinerary', key: 'nope' }, { title: 'X' }),
    /Day not found/,
  );
  assert.throws(
    () => updateDay(base, { field: 'itinerary_continued', key: 'only-here' }, { title: 'X' }),
    /Day not found/,
  );
  assert.throws(
    () => updateDay({}, { field: 'itinerary', key: 'only-here' }, { title: 'X' }),
    /Day not found/,
  );
});

test('updateDay validates the underlying data before editing', () => {
  assert.throws(
    () => updateDay({ itinerary: [day('a'), day('a')] }, { field: 'itinerary', key: 'a' }, { title: 'X' }),
    /Duplicate/,
  );
  assert.throws(
    () => updateDay({ itinerary: 'bad' }, { field: 'itinerary', key: 'a' }, { title: 'X' }),
    /must be an array/,
  );
});

test('a 101st day lives only in the continuation and editing it touches nothing else', () => {
  const base = {
    itinerary: days('main', 100),
    itinerary_continued: [day('extra-1')],
    marker: 'top',
  };
  const snapshot = clone(base);
  const rows = readDays(base);
  assert.equal(rows.length, 101);
  assert.equal(rows[100].ordinal, 101);
  assert.equal(rows[100].ref.field, 'itinerary_continued');

  const changed = updateDay(
    base,
    { field: 'itinerary_continued', key: 'extra-1' },
    { title: 'Extra edited' },
  );
  assert.deepEqual(changed.itinerary, snapshot.itinerary);
  assert.equal(changed.itinerary_continued[0].title, 'Extra edited');
  assert.equal(changed.marker, 'top');
  assert.deepEqual(base, snapshot);
  assert.deepEqual(changedDayIds(base, changed), ['["itinerary_continued","extra-1"]']);
  assert.deepEqual(buildItinerarySave(base, changed), {
    data: { itinerary_continued: changed.itinerary_continued },
  });
});

test('buildItinerarySave returns an empty payload when nothing changed', () => {
  const base = { title: 'T', itinerary: days('a', 3), itinerary_continued: days('b', 1) };
  assert.deepEqual(buildItinerarySave(base, clone(base)), { data: {} });
  assert.deepEqual(buildItinerarySave(base, base), { data: {} });
  assert.deepEqual(buildItinerarySave({}, {}), { data: {} });
});

test('buildItinerarySave is sparse: only the changed itinerary field is included', () => {
  const base = {
    title: 'T',
    itinerary: days('a', 2),
    itinerary_continued: days('b', 2),
  };
  const onlyFirst = updateDay(base, { field: 'itinerary', key: 'a-1' }, { title: 'A1 new' });
  const saveFirst = buildItinerarySave(base, onlyFirst);
  assert.deepEqual(Object.keys(saveFirst.data), ['itinerary']);
  assert.deepEqual(saveFirst.data.itinerary, onlyFirst.itinerary);

  const onlySecond = updateDay(
    base,
    { field: 'itinerary_continued', key: 'b-2' },
    { content: portableText() },
  );
  const saveSecond = buildItinerarySave(base, onlySecond);
  assert.deepEqual(Object.keys(saveSecond.data), ['itinerary_continued']);
  assert.deepEqual(saveSecond.data.itinerary_continued, onlySecond.itinerary_continued);
});

test('buildItinerarySave refuses any top-level non-itinerary mutation', () => {
  const base = { title: 'T', slug: { current: 'x' }, itinerary: days('a', 1) };

  const renamed = clone(base);
  renamed.title = 'Other';
  assert.throws(() => buildItinerarySave(base, renamed), /non-itinerary/);

  const removed = clone(base);
  delete removed.slug;
  assert.throws(() => buildItinerarySave(base, removed), /non-itinerary/);

  const added = clone(base);
  added.brandNew = 1;
  assert.throws(() => buildItinerarySave(base, added), /non-itinerary/);

  // Reordering keys of a nested top-level object is not a structural mutation.
  const reKeyed = clone(base);
  reKeyed.slug = { current: 'x' };
  assert.deepEqual(buildItinerarySave(base, reKeyed), { data: {} });
});

test('buildItinerarySave refuses key, order and length changes for M1', () => {
  const base = { itinerary: days('a', 3), itinerary_continued: days('b', 1) };

  const reordered = clone(base);
  [reordered.itinerary[0], reordered.itinerary[1]] = [
    reordered.itinerary[1],
    reordered.itinerary[0],
  ];
  assert.throws(() => buildItinerarySave(base, reordered), /key|order|length/);

  const renamedKey = clone(base);
  renamedKey.itinerary[0] = { ...renamedKey.itinerary[0], _key: 'a-renamed' };
  assert.throws(() => buildItinerarySave(base, renamedKey), /key|order|length/);

  const shortened = clone(base);
  shortened.itinerary.pop();
  assert.throws(() => buildItinerarySave(base, shortened), /key|order|length/);

  const lengthened = clone(base);
  lengthened.itinerary_continued.push(day('b-2'));
  assert.throws(() => buildItinerarySave(base, lengthened), /key|order|length/);

  const movedAcross = clone(base);
  movedAcross.itinerary_continued.unshift(movedAcross.itinerary.pop());
  assert.throws(() => buildItinerarySave(base, movedAcross), /key|order|length/);
});

test('buildItinerarySave validates both inputs', () => {
  const base = { itinerary: days('a', 1) };
  assert.throws(() => buildItinerarySave({ itinerary: 'bad' }, base), /must be an array/);
  assert.throws(
    () => buildItinerarySave(base, { itinerary: [day('a', { content: 'bad' })] }),
    /content.*array/,
  );
  assert.throws(
    () => buildItinerarySave(base, { itinerary: days('a', 101) }),
    /at most 100/,
  );
});

test('buildItinerarySave deep-copies the payload so later caller mutation cannot affect it', () => {
  const base = { itinerary: days('a', 1), itinerary_continued: days('b', 1) };
  const changed = updateDay(
    base,
    { field: 'itinerary_continued', key: 'b-1' },
    { content: portableText() },
  );
  const save = buildItinerarySave(base, changed);
  const payloadSnapshot = clone(save);

  changed.itinerary_continued[0].title = 'Mutated after save';
  changed.itinerary_continued[0].content[0].children[0].text = 'Mutated';
  changed.itinerary_continued[0].unknownBlockAttr.nested.push('mutated');
  assert.deepEqual(save, payloadSnapshot);

  save.data.itinerary_continued[0].title = 'Payload mutated';
  assert.equal(changed.itinerary_continued[0].title, 'Mutated after save');
});

test('changedDayIds returns exact composite IDs for title, content and other block changes', () => {
  const base = {
    itinerary: [day('same'), day('a-2'), day('a-3')],
    itinerary_continued: [day('same'), day('b-2')],
  };
  const changed = clone(base);
  changed.itinerary[1].title = 'New title';
  changed.itinerary_continued[0].content = portableText();
  changed.itinerary_continued[1].unknownBlockAttr = { replaced: true };

  assert.deepEqual(changedDayIds(base, changed), [
    '["itinerary","a-2"]',
    '["itinerary_continued","same"]',
    '["itinerary_continued","b-2"]',
  ]);
  assert.deepEqual(changedDayIds(base, clone(base)), []);
  assert.deepEqual(changedDayIds(base, base), []);
});

test('changedDayIds does not mutate frozen inputs and validates them', () => {
  const base = deepFreeze({ itinerary: days('a', 2) });
  const changed = deepFreeze(updateDay(base, { field: 'itinerary', key: 'a-2' }, { title: 'Z' }));
  assert.deepEqual(changedDayIds(base, changed), ['["itinerary","a-2"]']);
  assert.throws(
    () => changedDayIds(base, { itinerary: [day('a-1'), day('a-1')] }),
    /Duplicate/,
  );
});

test('unknown attributes on blocks and at the top level survive every operation', () => {
  const base = {
    _id: 'tour-9',
    customTop: { flags: ['x'], nested: { n: 1 } },
    itinerary: [
      day('a', { hero: { src: '/a.jpg', credit: 'Kee' }, rating: 5 }),
      day('b', { hero: { src: '/b.jpg' } }),
    ],
  };
  const changed = updateDay(base, { field: 'itinerary', key: 'b' }, { title: 'B new' });
  assert.deepEqual(changed.customTop, { flags: ['x'], nested: { n: 1 } });
  assert.deepEqual(changed.itinerary[0].hero, { src: '/a.jpg', credit: 'Kee' });
  assert.equal(changed.itinerary[0].rating, 5);
  assert.deepEqual(changed.itinerary[1].hero, { src: '/b.jpg' });

  const save = buildItinerarySave(base, changed);
  assert.deepEqual(save.data.itinerary[0].hero, { src: '/a.jpg', credit: 'Kee' });
  assert.equal(save.data.itinerary[1].title, 'B new');
});
