const fs = require('fs');
const levels = JSON.parse(fs.readFileSync('www/levels.json', 'utf8'));
if (levels.length !== 100) throw new Error(`Expected 100 levels, got ${levels.length}`);
const ids = new Set(), titles = new Set(), clues = new Set();
levels.forEach((l, i) => {
  if (ids.has(l.id)) throw new Error(`Duplicate id: ${l.id}`);
  ids.add(l.id);
  for (const key of ['id','type','title','scene','clue','answer','hint','time']) {
    if (l[key] === undefined || String(l[key]).trim() === '') throw new Error(`Level ${i + 1}: missing ${key}`);
  }
  if (titles.has(l.title)) throw new Error(`Duplicate title: ${l.title}`);
  if (clues.has(l.clue)) throw new Error(`Duplicate clue at level ${l.id}`);
  titles.add(l.title); clues.add(l.clue);
  if (l.choices && !l.choices.map(String).includes(String(l.answer))) {
    throw new Error(`Level ${l.id}: answer is not included in choices`);
  }
  if (l.type === 'memory' && !(l.memTime >= 3 && l.ask)) throw new Error(`Level ${l.id}: memory needs memTime and ask`);
  if (i > 0 && levels[i - 1].type === l.type) throw new Error(`Consecutive type at ${levels[i - 1].id}/${l.id}`);
});
console.log(`Validated ${levels.length} levels.`);
